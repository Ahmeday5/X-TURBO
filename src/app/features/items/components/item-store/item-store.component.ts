import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatMoney } from '../../../../shared/utils/format.util';
import { AppValidators } from '../../../../shared/validators/app-validators';
import { ItemStore, ItemStorePayload, MIN_TIER_QTY, PriceTier, priceBands, tierIssues } from '../../models/item-store.model';
import { ItemImagesService } from '../../services/item-images.service';
import { ItemStoreService } from '../../services/item-store.service';
import { ItemDraftService } from '../../services/item-draft.service';

/** Tier quantity floor, explained: one unit always sells at the base price. */
function minTierQty(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  if (v === null || v === '' || Number(v) >= MIN_TIER_QTY) return null;
  return { minTierQty: `أقل كمية للشريحة ${MIN_TIER_QTY} (المكتوب ${v}) — سعر القطعة الواحدة هو سعر البيع الأساسي` };
}

function tierRow(fb: NonNullableFormBuilder, t?: Partial<PriceTier>) {
  return fb.group({
    minQty: fb.control<number | null>(t?.minQty ?? null, [Validators.required, minTierQty, AppValidators.wholeNumber('الكمية')]),
    unitPrice: fb.control<number | null>(t?.unitPrice ?? null, [Validators.required, AppValidators.positive('سعر القطعة')]),
  });
}

type TierGroup = ReturnType<typeof tierRow>;

/**
 * Mobile-store settings of one item: published / fast delivery, and volume
 * price tiers (validated against each other and the base price), with a
 * preview of the prices the customer will see. Saves the whole record.
 */
@Component({
  selector: 'app-item-store',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, FormErrorComponent],
  templateUrl: './item-store.component.html',
  styleUrl: './item-store.component.scss',
})
export class ItemStoreComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ItemStoreService);
  private readonly images = inject(ItemImagesService);
  private readonly toast = inject(ToastService);

  /** `null` = a new, unsaved item: settings go to the draft and are saved right after the item. */
  readonly itemId = input<string | null>(null);
  /** The item's sale price — what one unit costs, and the ceiling for every tier. */
  readonly basePrice = input.required<number>();

  /** Provided by the item screen; holds a new item's pending store settings. */
  private readonly setup = inject(ItemDraftService, { optional: true });
  protected readonly draftMode = computed(() => !this.itemId() && !!this.setup);

  protected readonly money = formatMoney;
  protected readonly minQty = MIN_TIER_QTY;

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly current = signal<ItemStore | null>(null);
  protected readonly imagesCount = signal<number | null>(null);

  protected readonly form = this.fb.group({
    isPublished: [false],
    isFastDelivery: [false],
    priceTiers: this.fb.array<TierGroup>([]),
  });

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected get tiers(): FormArray<TierGroup> {
    return this.form.controls.priceTiers;
  }

  /** Cross-tier problems by row index (duplicates, prices not falling). */
  protected readonly issues = computed(() => tierIssues(this.draft().priceTiers ?? [], this.basePrice()));

  /** What the customer sees: quantity bands with the unit price and saving. */
  protected readonly bands = computed(() =>
    priceBands(
      (this.draft().priceTiers ?? []).map((t) => ({ minQty: Number(t.minQty), unitPrice: Number(t.unitPrice) })),
      this.basePrice(),
    ),
  );

  protected readonly publishedWithoutImages = computed(
    () => !!this.draft().isPublished && (this.draftMode() ? this.setup!.images().length === 0 : this.imagesCount() === 0),
  );

  constructor() {
    effect(() => {
      const id = this.itemId();
      untracked(() => {
        if (id) this.load(id);
        else if (this.setup) this.restoreDraft();
      });
    });

    // New item: every edit is mirrored into the draft, with whether it's valid
    // (the item can't be saved while the tiers have errors).
    effect(() => {
      if (!this.draftMode()) return;
      this.draft();
      const issues = this.issues();
      untracked(() => this.setup!.setStore(this.payload(), this.form.valid && !issues.size));
    });
  }

  /** Back on this tab while creating: show what was entered before. */
  private restoreDraft(): void {
    const s = this.setup!.store();
    this.apply({ itemId: '', isPublished: s?.isPublished ?? false, isFastDelivery: s?.isFastDelivery ?? false, priceTiers: s?.priceTiers ?? [] });
    this.submitted.set(!this.setup!.storeValid());
  }

  protected load(itemId = this.itemId()): void {
    if (!itemId) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .get(itemId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (s) => this.apply(s),
        error: (err: ApiError) => this.loadError.set(err.message || 'تعذّر تحميل بيانات المتجر'),
      });
    this.images.list(itemId).subscribe({ next: (list) => this.imagesCount.set(list.length), error: () => this.imagesCount.set(null) });
  }

  protected addTier(): void {
    const quantities = this.tiers.controls.map((g) => Number(g.controls.minQty.value)).filter((n) => n > 0);
    const suggested = quantities.length ? Math.max(...quantities) * 2 : 5;
    this.tiers.push(tierRow(this.fb, { minQty: Math.max(MIN_TIER_QTY, suggested) }));
    this.form.markAsDirty();
  }

  protected removeTier(index: number): void {
    this.tiers.removeAt(index);
    this.form.markAsDirty();
  }

  protected reset(): void {
    const s = this.current();
    if (s) this.apply(s);
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.draftMode()) return; // saved together with the new item
    if (this.form.invalid || this.issues().size) {
      this.form.markAllAsTouched();
      this.toast.warning('راجع شرائح الأسعار — الأخطاء موضحة تحت كل شريحة');
      return;
    }
    const payload = this.payload();
    this.saving.set(true);
    this.api
      .save(this.itemId()!, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (s) => {
          this.apply(s);
          this.toast.success(s.isPublished ? 'تم حفظ بيانات المتجر — الصنف ظاهر في التطبيق' : 'تم حفظ بيانات المتجر');
        },
        // 422 `priceTiers[1].unitPrice` etc. → under that tier's field.
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }

  /** Form → API payload (tiers rounded and sorted by quantity). */
  private payload(): ItemStorePayload {
    const v = this.form.getRawValue();
    return {
      isPublished: v.isPublished,
      isFastDelivery: v.isFastDelivery,
      priceTiers: v.priceTiers
        .filter((t) => t.minQty !== null && t.unitPrice !== null)
        .map((t) => ({ minQty: Math.floor(Number(t.minQty)), unitPrice: Math.round(Number(t.unitPrice) * 100) / 100 }))
        .sort((a, b) => a.minQty - b.minQty),
    };
  }

  private apply(s: ItemStore): void {
    this.current.set(s);
    this.submitted.set(false);
    const tiers = [...(s.priceTiers ?? [])].sort((a, b) => a.minQty - b.minQty);
    this.tiers.clear({ emitEvent: false });
    for (const t of tiers) this.tiers.push(tierRow(this.fb, t), { emitEvent: false });
    this.form.reset({ isPublished: s.isPublished, isFastDelivery: s.isFastDelivery, priceTiers: tiers });
  }
}
