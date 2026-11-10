import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { ApiError } from '../../../../core/models/api-response.model';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { AppValidators } from '../../../../shared/validators/app-validators';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { WarehouseCardComponent, WarehouseCardData } from '../../components/warehouse-card/warehouse-card.component';
import { Warehouse, WarehousePayload, WAREHOUSE_TYPES, WAREHOUSE_TYPE_VIEW, WarehouseType } from '../../models/warehouse.model';
import { WarehousesService } from '../../services/warehouses.service';


/**
 * Create / edit a warehouse. `?id=` switches to edit mode (bound from the
 * URL, so a refresh keeps the same warehouse open). A live card previews it.
 */
@Component({
  selector: 'app-warehouse-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, IconComponent, FormErrorComponent, WarehouseCardComponent],
  templateUrl: './warehouse-form.page.html',
  styleUrl: './warehouse-form.page.scss',
})
export class WarehouseFormPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(WarehousesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Bound from route data / query string. */
  readonly navId = input.required<string>();
  readonly id = input<string>();

  protected readonly types = WAREHOUSE_TYPES;
  protected readonly typeView = WAREHOUSE_TYPE_VIEW;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    type: ['branch' as WarehouseType, Validators.required],
    manager: ['', Validators.maxLength(60)],
    phone: ['', AppValidators.phone()],
    city: ['', [Validators.required, Validators.maxLength(60)]],
    address: ['', Validators.maxLength(200)],
    capacity: [0, [Validators.required, Validators.min(0)]],
    allowNegative: [false],
    isDefault: [false],
    isActive: [true],
    notes: ['', Validators.maxLength(500)],
  });

  protected readonly current = signal<Warehouse | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal<'save' | 'saveNew' | null>(null);
  protected readonly isEdit = computed(() => !!this.id());
  /** The default can't be unset here — another warehouse must take over. */
  protected readonly lockedDefault = computed(() => !!this.current()?.isDefault);

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly preview = computed<WarehouseCardData>(() => {
    const v = { ...this.form.getRawValue(), ...this.draft() };
    const c = this.current();
    const capacity = Number(v.capacity) || 0;
    const totalQty = c?.totalQty ?? 0;
    return {
      code: c?.code ?? 'جديد',
      name: v.name.trim(),
      type: v.type,
      city: v.city.trim(),
      manager: v.manager.trim(),
      capacity,
      isDefault: v.isDefault,
      isActive: v.isActive,
      itemsCount: c?.itemsCount ?? 0,
      totalQty,
      stockValue: c?.stockValue ?? 0,
      lowStockCount: c?.lowStockCount ?? 0,
      usagePct: capacity > 0 ? Math.round((totalQty / capacity) * 100) : 0,
    };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => (id ? this.load(id) : this.resetForCreate()));
    });

    // The default warehouse is always active.
    this.form.controls.isDefault.valueChanges.pipe(takeUntilDestroyed()).subscribe((isDefault) => {
      const active = this.form.controls.isActive;
      if (isDefault) {
        active.setValue(true, { emitEvent: false });
        active.disable({ emitEvent: false });
      } else if (!this.lockedDefault()) {
        active.enable({ emitEvent: false });
      }
    });
  }

  protected submit(mode: 'save' | 'saveNew'): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('راجع الحقول المطلوبة قبل الحفظ');
      return;
    }
    const id = this.id();
    const payload = this.payload();
    this.saving.set(mode);
    (id ? this.api.update(id, payload) : this.api.create(payload))
      .pipe(finalize(() => this.saving.set(null)))
      .subscribe({
        next: (w) => {
          this.toast.success(id ? 'تم تحديث بيانات المخزن' : `تم إضافة المخزن ${w.code}`);
          if (mode === 'saveNew') this.resetForCreate();
          else this.router.navigate(['/warehouses']);
        },
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.api
      .get(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (w) => {
          this.current.set(w);
          this.form.reset({
            name: w.name,
            type: w.type,
            manager: w.manager,
            phone: w.phone,
            city: w.city,
            address: w.address,
            capacity: w.capacity,
            allowNegative: w.allowNegative,
            isDefault: w.isDefault,
            isActive: w.isActive,
            notes: w.notes,
          });
          const lock = { emitEvent: false };
          if (w.isDefault) {
            this.form.controls.isDefault.disable(lock);
            this.form.controls.isActive.disable(lock);
          } else {
            this.form.controls.isDefault.enable(lock);
            this.form.controls.isActive.enable(lock);
          }
        },
        error: () => this.router.navigate(['/warehouses/define'], { replaceUrl: true }),
      });
  }

  private resetForCreate(): void {
    this.current.set(null);
    this.form.reset();
    this.form.controls.isDefault.enable({ emitEvent: false });
    this.form.controls.isActive.enable({ emitEvent: false });
    if (this.id()) this.router.navigate([], { queryParams: { id: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private payload(): WarehousePayload {
    const v = this.form.getRawValue();
    return {
      ...v,
      name: v.name.trim(),
      manager: v.manager.trim(),
      phone: v.phone.trim(),
      city: v.city.trim(),
      address: v.address.trim(),
      notes: v.notes.trim(),
      capacity: Math.round(Number(v.capacity) || 0),
    };
  }
}
