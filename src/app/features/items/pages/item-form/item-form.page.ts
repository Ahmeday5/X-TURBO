import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import { ItemCardComponent, ItemCardData } from '../../components/item-card/item-card.component';
import { Item, ITEM_UNITS, ItemPayload, marginPct } from '../../models/item.model';
import { ItemGroupsService } from '../../services/item-groups.service';
import { ItemsService } from '../../services/items.service';

const BARCODE_PATTERN = /^\d{8,14}$/;

/**
 * Create / edit an item. `?id=` switches to edit mode (bound from the URL,
 * so a refresh keeps the same item open). A live card previews the result.
 */
@Component({
  selector: 'app-item-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    FormErrorComponent,
    SearchableSelectComponent,
    ItemCardComponent,
  ],
  templateUrl: './item-form.page.html',
  styleUrl: './item-form.page.scss',
})
export class ItemFormPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly items = inject(ItemsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Bound from route data / query string. */
  readonly navId = input.required<string>();
  readonly id = input<string>();

  protected readonly units = ITEM_UNITS;
  protected readonly groups = toSignal(inject(ItemGroupsService).lookup(), { initialValue: [] });
  protected readonly groupOptions = computed<SearchableSelectOption[]>(() =>
    this.groups().map((g) => ({ value: g.id, label: g.name })),
  );

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    groupId: ['', Validators.required],
    unit: [ITEM_UNITS[0] as string, Validators.required],
    brand: ['', Validators.maxLength(60)],
    barcode: ['', Validators.pattern(BARCODE_PATTERN)],
    purchasePrice: [0, [Validators.required, Validators.min(0)]],
    salePrice: [0, [Validators.required, Validators.min(0)]],
    minStock: [0, [Validators.required, Validators.min(0)]],
    description: ['', Validators.maxLength(500)],
    isActive: [true],
  });

  /** The loaded item in edit mode. */
  protected readonly current = signal<Item | null>(null);
  protected readonly loadingItem = signal(false);
  protected readonly saving = signal<'save' | 'saveNew' | null>(null);
  protected readonly isEdit = computed(() => !!this.id());

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly preview = computed<ItemCardData>(() => {
    const v = { ...this.form.getRawValue(), ...this.draft() };
    const group = this.groups().find((g) => g.id === v.groupId);
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
      this.toast.warning('راجع الحقول المطلوبة قبل الحفظ');
      return;
    }
    const payload = this.payload();
    const id = this.id();
    const request$ = id ? this.items.update(id, payload) : this.items.create(payload);

    this.saving.set(mode);
    request$.pipe(finalize(() => this.saving.set(null))).subscribe((item) => {
      this.toast.success(id ? 'تم تحديث الصنف' : `تم إضافة الصنف ${item.code}`);
      if (mode === 'saveNew') this.resetForCreate();
      else this.router.navigate(['/items/directory']);
    });
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
            barcode: item.barcode,
            purchasePrice: item.purchasePrice,
            salePrice: item.salePrice,
            minStock: item.minStock,
            description: item.description,
            isActive: item.isActive,
          });
        },
        error: () => this.router.navigate(['/items/define'], { replaceUrl: true }),
      });
  }

  private resetForCreate(): void {
    this.current.set(null);
    this.form.reset();
    if (this.id()) this.router.navigate([], { queryParams: { id: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private payload(): ItemPayload {
    const v = this.form.getRawValue();
    return {
      ...v,
      name: v.name.trim(),
      brand: v.brand.trim(),
      description: v.description.trim(),
      unit: v.unit as Item['unit'],
      purchasePrice: Number(v.purchasePrice),
      salePrice: Number(v.salePrice),
      minStock: Number(v.minStock),
    };
  }
}
