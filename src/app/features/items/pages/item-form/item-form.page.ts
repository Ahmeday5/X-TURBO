import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, map, switchMap } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { ApiError } from '../../../../core/models/api-response.model';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { AppValidators } from '../../../../shared/validators/app-validators';
import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';
import { BarcodeComponent } from '../../../../shared/barcode/barcode.component';
import { generateInternalBarcode } from '../../../../shared/barcode/internal-barcode';
import { ItemImagesComponent } from '../../components/item-images/item-images.component';
import { ItemStoreComponent } from '../../components/item-store/item-store.component';
import { ItemFitmentsComponent } from '../../components/item-fitments/item-fitments.component';
import { ItemReviewsComponent } from '../../components/item-reviews/item-reviews.component';
import { REVIEW_FILTERS } from '../../models/item-review.model';
import { DRAFT_PART_LABEL, DraftCommitResult, DraftPart, ItemDraftService } from '../../services/item-draft.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import { ItemCardComponent, ItemCardData } from '../../components/item-card/item-card.component';
import {
  COMPATIBLE_WITH_MAX,
  DISCOUNT_RANGE,
  discountedPrice,
  Item,
  ITEM_CONFLICT_FIELD,
  ITEM_UNITS,
  ItemPayload,
  marginPct,
} from '../../models/item.model';
import { acceptsItems, flattenGroups, ItemGroupNode } from '../../models/item-group.model';
import { ItemGroupsService } from '../../services/item-groups.service';
import { ItemsService } from '../../services/items.service';


type ItemTab = 'details' | 'images' | 'store' | 'fitments' | 'reviews';

const ITEM_TABS: readonly { key: ItemTab; label: string; icon: IconName }[] = [
  { key: 'details', label: 'البيانات الأساسية', icon: 'box' },
  { key: 'images', label: 'الصور', icon: 'image' },
  { key: 'store', label: 'بيانات المتجر', icon: 'store' },
  { key: 'fitments', label: 'التوافق مع السيارات', icon: 'car' },
  { key: 'reviews', label: 'التقييمات', icon: 'star' },
];

/** Tab to reopen when a part of a new item failed to save. */
const TAB_OF_PART: Record<DraftPart, ItemTab> = { images: 'images', store: 'store', fitments: 'fitments' };

/** URL params owned by the reviews list — dropped when leaving its tab. */
const REVIEW_URL_PARAMS = ['q', 'page', 'size', 'sort', 'dir', 'view', ...REVIEW_FILTERS] as const;

/**
 * Create / edit an item. `?id=` switches to edit mode (bound from the URL,
 * so a refresh keeps the same item open). A live card previews the result.
 */
@Component({
  selector: 'app-item-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BarcodeComponent,
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    FormErrorComponent,
    SearchableSelectComponent,
    ItemCardComponent,
    ItemImagesComponent,
    ItemStoreComponent,
    ItemFitmentsComponent,
    ItemReviewsComponent,
  ],
  templateUrl: './item-form.page.html',
  styleUrl: './item-form.page.scss',
  // One draft per screen: what a NEW item's images / store / fitment tabs prepare.
  providers: [ItemDraftService],
})
export class ItemFormPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly items = inject(ItemsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly setup = inject(ItemDraftService);

  /** Bound from route data / query string. */
  readonly navId = input.required<string>();
  readonly id = input<string>();
  /** `?tab=` — every tab works while creating (saved with the item), except reviews. */
  readonly tab = input<string>();
  /** `?groupId=` — pre-selects the group of a NEW item ("add item" from the groups tree). */
  readonly groupId = input<string>();

  protected readonly tabs = computed(() => (this.isEdit() ? ITEM_TABS : ITEM_TABS.filter((t) => t.key !== 'reviews')));
  protected readonly activeTab = computed<ItemTab>(() => {
    const t = this.tab();
    return this.tabs().some((x) => x.key === t) ? (t as ItemTab) : 'details';
  });

  /** In-store EAN-13 (prefix 2) for items that came without a manufacturer barcode. */
  protected generateBarcode(): void {
    const control = this.form.controls.barcode;
    control.setValue(generateInternalBarcode());
    control.markAsDirty();
    control.markAsTouched();
  }

  protected setTab(tab: ItemTab): void {
    const resetReviews = Object.fromEntries(REVIEW_URL_PARAMS.map((k) => [k, null]));
    this.router.navigate([], {
      queryParams: { ...resetReviews, tab: tab === 'details' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected readonly units = ITEM_UNITS;
  protected readonly compatibleMax = COMPATIBLE_WITH_MAX;
  protected readonly discountRange = DISCOUNT_RANGE;

  /** Group tree — items attach to LEAF groups only (the server answers 409 `GROUP_NOT_LEAF` otherwise). */
  private readonly groupTree = toSignal(inject(ItemGroupsService).tree(), { initialValue: [] as ItemGroupNode[] });
  private readonly flatGroups = computed(() => flattenGroups(this.groupTree()));
  protected readonly groupOptions = computed<SearchableSelectOption[]>(() =>
    this.flatGroups()
      .filter((g) => acceptsItems(g) && (g.node.isActive || g.node.id === this.current()?.groupId))
      .map((g) => ({ value: g.node.id, label: g.node.name, hint: g.depth ? g.path : undefined })),
  );
  /** Editing an item whose group can't hold items any more (got sub-groups, or is a main group): say why. */
  protected readonly groupNotLeaf = computed(() => {
    const id = this.current()?.groupId;
    const hit = id ? this.flatGroups().find((g) => g.node.id === id) : undefined;
    if (!hit || acceptsItems(hit)) return null;
    return { name: hit.node.name, reason: hit.isLeaf ? 'مجموعة رئيسية' : 'أصبح تحتها فروع' };
  });

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    groupId: ['', Validators.required],
    unit: [ITEM_UNITS[0] as string, Validators.required],
    brand: ['', Validators.maxLength(60)],
    barcode: ['', AppValidators.barcode()],
    sku: ['', AppValidators.sku()],
    purchasePrice: [0, [Validators.required, Validators.min(0)]],
    salePrice: [0, [Validators.required, Validators.min(0)]],
    discountPercent: [0, [Validators.min(DISCOUNT_RANGE.min), Validators.max(DISCOUNT_RANGE.max)]],
    minStock: [0, [Validators.required, Validators.min(0)]],
    description: ['', Validators.maxLength(500)],
    compatibleWith: ['', Validators.maxLength(COMPATIBLE_WITH_MAX)],
    isActive: [true],
  });

  /** The loaded item in edit mode. */
  protected readonly current = signal<Item | null>(null);
  protected readonly loadingItem = signal(false);
  protected readonly saving = signal<'save' | 'saveNew' | null>(null);
  protected readonly isEdit = computed(() => !!this.id());

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Live sale price — the ceiling for a new item's price tiers. */
  protected readonly liveSalePrice = computed(() => Number(this.draft().salePrice) || 0);

  protected readonly preview = computed<ItemCardData>(() => {
    const v = { ...this.form.getRawValue(), ...this.draft() };
    const group = this.flatGroups().find((g) => g.node.id === v.groupId)?.node;
    return {
      code: this.current()?.code ?? 'جديد',
      name: v.name.trim(),
      groupName: group?.name ?? '',
      groupColor: group?.color ?? '',
      unit: v.unit as Item['unit'],
      purchasePrice: Number(v.purchasePrice) || 0,
      salePrice: Number(v.salePrice) || 0,
      stock: this.current()?.stock ?? 0,
      minStock: Number(v.minStock) || 0,
      isActive: v.isActive,
    };
  });

  protected readonly margin = computed(() => marginPct(this.preview().purchasePrice, this.preview().salePrice));
  protected readonly profit = computed(() => this.preview().salePrice - this.preview().purchasePrice);

  /** What the app customer pays after the item discount. */
  protected readonly discount = computed(() => {
    const pct = Number(this.draft().discountPercent) || 0;
    const sale = this.preview().salePrice;
    const after = discountedPrice(sale, pct);
    return { pct, after, saved: Math.round((sale - after) * 100) / 100, belowCost: pct > 0 && after < this.preview().purchasePrice };
  });

  constructor() {
    // React to ?id= changes (edit ↔ create) without leaving the page.
    effect(() => {
      const id = this.id();
      untracked(() => (id ? this.load(id) : this.resetForCreate()));
    });
  }

  protected submit(mode: 'save' | 'saveNew'): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.setTab('details');
      this.toast.warning('راجع الحقول المطلوبة في «البيانات الأساسية» قبل الحفظ');
      return;
    }
    const id = this.id();
    if (!id && !this.setup.storeValid()) {
      this.setTab('store');
      this.toast.warning('راجع شرائح الأسعار في «بيانات المتجر» — الأخطاء موضحة تحت كل شريحة');
      return;
    }
    const payload = this.payload();

    this.saving.set(mode);
    if (id) {
      this.items
        .update(id, payload)
        .pipe(finalize(() => this.saving.set(null)))
        .subscribe({
          next: () => {
            this.toast.success('تم تحديث الصنف');
            this.router.navigate(['/items/directory']);
          },
          // 422 → messages under their fields (e.g. duplicate barcode, price rules).
          error: (err: ApiError) => this.showServerErrors(err),
        });
      return;
    }

    // Create the item, then apply what its other tabs prepared.
    this.items
      .create(payload)
      .pipe(
        switchMap((item) => this.setup.commit(item.id).pipe(map((result) => ({ item, result })))),
        finalize(() => this.saving.set(null)),
      )
      .subscribe({
        next: ({ item, result }) => this.afterCreate(item, result, mode),
        error: (err: ApiError) => this.showServerErrors(err),
      });
  }

  /**
   * The item exists now. Fully saved → next item or the directory. A part
   * failed → open the new item in edit mode on that tab so it can be finished.
   */
  private afterCreate(item: Item, result: DraftCommitResult, mode: 'save' | 'saveNew'): void {
    const extras = this.setup.pendingSummary();
    if (result.failed.length) {
      const parts = result.failed.map((p) => DRAFT_PART_LABEL[p]).join('، ');
      this.toast.warning(`تم إضافة الصنف ${item.code}، لكن تعذّر حفظ: ${parts} — أكملها من شاشة تعديل الصنف`);
      this.setup.reset();
      this.router.navigate(['/items/define'], { queryParams: { id: item.id, tab: TAB_OF_PART[result.failed[0]] } });
      return;
    }
    this.toast.success(`تم إضافة الصنف ${item.code}${extras ? ` مع ${extras}` : ''}`);
    this.setup.reset();
    if (mode === 'saveNew') {
      this.resetForCreate();
      this.setTab('details');
    } else {
      this.router.navigate(['/items/directory']);
    }
  }

  /** 422 → under their fields; 409 uniqueness / leaf-group → under the field it concerns (the toast already shows it). */
  private showServerErrors(err: ApiError): void {
    const conflictField = err.code ? ITEM_CONFLICT_FIELD[err.code] : undefined;
    if (conflictField) {
      const control = this.form.controls[conflictField];
      control.setErrors({ ...(control.errors ?? {}), server: err.message });
      control.markAsTouched();
      this.setTab('details');
      return;
    }
    if (err.fieldErrors) this.setTab('details');
    applyServerErrors(this.form, err);
  }

  private load(id: string): void {
    this.loadingItem.set(true);
    this.items
      .get(id)
      .pipe(finalize(() => this.loadingItem.set(false)))
      .subscribe({
        next: (item) => {
          this.current.set(item);
          this.form.reset({
            name: item.name,
            groupId: item.groupId,
            unit: item.unit,
            brand: item.brand,
            barcode: item.barcode ?? '',
            sku: item.sku ?? '',
            purchasePrice: item.purchasePrice,
            salePrice: item.salePrice,
            discountPercent: item.discountPercent ?? 0,
            minStock: item.minStock,
            description: item.description,
            compatibleWith: item.compatibleWith ?? '',
            isActive: item.isActive,
          });
        },
        error: () => this.router.navigate(['/items/define'], { replaceUrl: true }),
      });
  }

  private resetForCreate(): void {
    this.current.set(null);
    this.form.reset({ groupId: this.groupId() ?? '' });
    this.setup.reset();
    if (this.id()) this.router.navigate([], { queryParams: { id: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private payload(): ItemPayload {
    const v = this.form.getRawValue();
    return {
      ...v,
      name: v.name.trim(),
      brand: v.brand.trim(),
      barcode: v.barcode.trim(),
      sku: v.sku.trim() || null,
      discountPercent: Number(v.discountPercent) || 0,
      description: v.description.trim(),
      compatibleWith: v.compatibleWith.trim() || null,
      unit: v.unit as Item['unit'],
      purchasePrice: Number(v.purchasePrice),
      salePrice: Number(v.salePrice),
      minStock: Number(v.minStock),
    };
  }
}
