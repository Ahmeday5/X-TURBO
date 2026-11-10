import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CarMake, CarModel, CarModelPayload, maxModelYear, MIN_MODEL_YEAR } from '../../models/car.model';
import { CarCatalogService } from '../../services/car-catalog.service';

/** `yearTo` (optional) must not precede `yearFrom`. Error lands on `yearTo`. */
function yearRangeValidator(group: AbstractControl): ValidationErrors | null {
  const from = Number(group.get('yearFrom')?.value);
  const rawTo = group.get('yearTo')?.value;
  const toCtrl = group.get('yearTo');
  if (!toCtrl) return null;
  const invalid = rawTo !== null && rawTo !== '' && Number(rawTo) < from;
  const { range, ...rest } = toCtrl.errors ?? {};
  if (invalid) toCtrl.setErrors({ ...rest, range: 'سنة النهاية قبل سنة البداية' });
  else if (range) toCtrl.setErrors(Object.keys(rest).length ? rest : null);
  return null;
}

/** Create / edit a car model. `model` null → create under `defaultMakeId`. */
@Component({
  selector: 'app-car-model-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent],
  template: `
    <app-modal [open]="open()" [title]="isEdit() ? 'تعديل الموديل' : 'موديل جديد'" size="sm" (closed)="closed.emit()">
      <form id="car-model-form" class="cd" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label class="ui-field">
          <span class="ui-label is-required">الماركة</span>
          <select class="ui-input" formControlName="makeId">
            <option value="" disabled>اختر الماركة</option>
            @for (m of makes(); track m.id) {<option [value]="m.id">{{ m.name }}</option>}
          </select>
          <app-form-error [control]="form.controls.makeId" label="الماركة" />
        </label>
        <label class="ui-field">
          <span class="ui-label is-required">اسم الموديل</span>
          <input class="ui-input" formControlName="name" placeholder="مثال: كورولا" />
          <app-form-error [control]="form.controls.name" label="اسم الموديل" />
        </label>
        <label class="ui-field">
          <span class="ui-label">الاسم بالإنجليزي</span>
          <input class="ui-input ltr" formControlName="nameEn" placeholder="Corolla" />
          <app-form-error [control]="form.controls.nameEn" label="الاسم بالإنجليزي" />
        </label>
        <div class="cd__years">
          <label class="ui-field">
            <span class="ui-label is-required">من سنة</span>
            <input class="ui-input ltr" type="number" [min]="minYear" [max]="maxYear" step="1" formControlName="yearFrom" />
            <app-form-error [control]="form.controls.yearFrom" label="سنة البداية" />
          </label>
          <label class="ui-field">
            <span class="ui-label">إلى سنة</span>
            <input class="ui-input ltr" type="number" [min]="minYear" [max]="maxYear" step="1" formControlName="yearTo"
              placeholder="حتى الآن" />
            <app-form-error [control]="form.controls.yearTo" label="سنة النهاية" />
          </label>
        </div>
        <span class="ui-hint">اترك «إلى سنة» فارغة لو الموديل لسه بيتصنّع.</span>
        <label class="ui-switch">
          <input type="checkbox" formControlName="isActive" />
          <span class="ui-switch__track"></span>
          {{ form.controls.isActive.value ? 'موديل نشط' : 'موقوف — مخفي من التطبيق' }}
        </label>
      </form>

      <div modal-footer class="cd__footer">
        <button type="button" class="ui-btn ui-btn--ghost" (click)="closed.emit()">إلغاء</button>
        <button type="submit" form="car-model-form" class="ui-btn ui-btn--primary" [class.is-loading]="saving()" [disabled]="saving()">
          <app-icon name="check" [size]="16" /> {{ isEdit() ? 'حفظ التعديلات' : 'إضافة الموديل' }}
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: '../car-dialog.shared.scss',
})
export class CarModelDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(CarCatalogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly model = input<CarModel | null>(null);
  readonly makes = input<readonly CarMake[]>([]);
  readonly defaultMakeId = input<string | null>(null);

  readonly closed = output<void>();
  readonly saved = output<CarModel>();

  protected readonly minYear = MIN_MODEL_YEAR;
  protected readonly maxYear = maxModelYear();
  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => !!this.model());

  protected readonly form = this.fb.group(
    {
      makeId: ['', Validators.required],
      name: ['', [Validators.required, Validators.maxLength(60)]],
      nameEn: ['', Validators.maxLength(60)],
      yearFrom: [this.maxYear - 1, [Validators.required, Validators.min(MIN_MODEL_YEAR), Validators.max(this.maxYear)]],
      yearTo: this.fb.control<number | null>(null, [Validators.min(MIN_MODEL_YEAR), Validators.max(this.maxYear)]),
      isActive: [true],
    },
    { validators: yearRangeValidator },
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const m = this.model();
      const makeId = this.defaultMakeId() ?? '';
      untracked(() =>
        this.form.reset(
          m
            ? { makeId: m.makeId, name: m.name, nameEn: m.nameEn ?? '', yearFrom: m.yearFrom, yearTo: m.yearTo, isActive: m.isActive }
            : { makeId, name: '', nameEn: '', yearFrom: this.maxYear - 1, yearTo: null, isActive: true },
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
    const yearTo = v.yearTo === null || String(v.yearTo) === '' ? null : Math.floor(Number(v.yearTo));
    const payload: CarModelPayload = {
      makeId: v.makeId,
      name: v.name.trim(),
      nameEn: v.nameEn.trim() || null,
      yearFrom: Math.floor(Number(v.yearFrom)),
      yearTo,
      isActive: v.isActive,
    };
    const id = this.model()?.id;
    this.saving.set(true);
    (id ? this.api.updateModel(id, payload) : this.api.createModel(payload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (model) => {
          this.toast.success(id ? 'تم تحديث الموديل' : `تمت إضافة ${model.name}`);
          this.saved.emit(model);
        },
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }
}
