import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CarMake, CarMakePayload } from '../../models/car.model';
import { CarCatalogService } from '../../services/car-catalog.service';

/** Create / edit a car make. `make` null → create (sort order defaults to the end of the list). */
@Component({
  selector: 'app-car-make-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent],
  template: `
    <app-modal [open]="open()" [title]="isEdit() ? 'تعديل الماركة' : 'ماركة جديدة'" size="sm" (closed)="closed.emit()">
      <form id="car-make-form" class="cd" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label class="ui-field">
          <span class="ui-label is-required">الاسم بالعربي</span>
          <input class="ui-input" formControlName="name" placeholder="مثال: تويوتا" />
          <app-form-error [control]="form.controls.name" label="الاسم" />
        </label>
        <label class="ui-field">
          <span class="ui-label">الاسم بالإنجليزي</span>
          <input class="ui-input ltr" formControlName="nameEn" placeholder="Toyota" />
          <app-form-error [control]="form.controls.nameEn" label="الاسم بالإنجليزي" />
        </label>
        <label class="ui-field">
          <span class="ui-label is-required">ترتيب العرض</span>
          <input class="ui-input" type="number" min="0" step="1" formControlName="sortOrder" />
          <span class="ui-hint">الأصغر يظهر أولًا في تطبيق الموبايل.</span>
          <app-form-error [control]="form.controls.sortOrder" label="ترتيب العرض" />
        </label>
        <label class="ui-switch">
          <input type="checkbox" formControlName="isActive" />
          <span class="ui-switch__track"></span>
          {{ form.controls.isActive.value ? 'ماركة نشطة — تظهر في التطبيق' : 'موقوفة — مخفية من التطبيق' }}
        </label>
      </form>

      <div modal-footer class="cd__footer">
        <button type="button" class="ui-btn ui-btn--ghost" (click)="closed.emit()">إلغاء</button>
        <button type="submit" form="car-make-form" class="ui-btn ui-btn--primary" [class.is-loading]="saving()" [disabled]="saving()">
          <app-icon name="check" [size]="16" /> {{ isEdit() ? 'حفظ التعديلات' : 'إضافة الماركة' }}
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: '../car-dialog.shared.scss',
})
export class CarMakeDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(CarCatalogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly make = input<CarMake | null>(null);
  /** Used to place a new make at the end. */
  readonly nextSortOrder = input(0);

  readonly closed = output<void>();
  readonly saved = output<CarMake>();

  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => !!this.make());

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    nameEn: ['', Validators.maxLength(60)],
    sortOrder: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const m = this.make();
      const next = this.nextSortOrder();
      untracked(() =>
        this.form.reset(
          m
            ? { name: m.name, nameEn: m.nameEn ?? '', sortOrder: m.sortOrder, isActive: m.isActive }
            : { name: '', nameEn: '', sortOrder: next, isActive: true },
        ),
      );
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: CarMakePayload = {
      name: v.name.trim(),
      nameEn: v.nameEn.trim() || null,
      sortOrder: Math.floor(Number(v.sortOrder) || 0),
      isActive: v.isActive,
    };
    const id = this.make()?.id;
    this.saving.set(true);
    (id ? this.api.updateMake(id, payload) : this.api.createMake(payload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (make) => {
          this.toast.success(id ? 'تم تحديث الماركة' : `تمت إضافة ${make.name}`);
          this.saved.emit(make);
        },
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }
}
