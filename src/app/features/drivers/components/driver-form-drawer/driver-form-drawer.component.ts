import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DrawerComponent } from '../../../../shared/components/drawer/drawer.component';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PasswordInputComponent } from '../../../../shared/components/password-input/password-input.component';
import { formatDateTime } from '../../../../shared/utils/format.util';
import { toLocalMobile } from '../../../../shared/utils/phone.util';
import { AppValidators } from '../../../../shared/validators/app-validators';
import { PasswordStrengthComponent } from '../../../admin/components/password-strength/password-strength.component';
import { generatePassword } from '../../../admin/models/user.model';
import { passwordPolicyValidator, sameAsPasswordValidator } from '../../../admin/utils/password-policy.validator';
import { Driver, DRIVER_ERROR_CODES, DriverPayload, VEHICLE_TYPES } from '../../models/driver.model';
import { DriversService } from '../../services/drivers.service';
import { copyToClipboard } from '../../utils/clipboard.util';

/**
 * Create / edit a driver in a side drawer. `driverId` = `'new'` creates, an
 * id edits, `''` keeps it closed (bound to a URL param by the page). The
 * password is set on create only — later changes go through reset-password.
 */
@Component({
  selector: 'app-driver-form-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AvatarComponent,
    DrawerComponent,
    FormErrorComponent,
    IconComponent,
    PasswordInputComponent,
    PasswordStrengthComponent,
  ],
  templateUrl: './driver-form-drawer.component.html',
  styleUrl: './driver-form-drawer.component.scss',
})
export class DriverFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(DriversService);
  private readonly toast = inject(ToastService);

  readonly driverId = input<string>('');
  readonly closed = output<void>();
  readonly saved = output<Driver>();

  protected readonly vehicleTypes = VEHICLE_TYPES;
  protected readonly dateTime = formatDateTime;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    phone: ['', [Validators.required, AppValidators.mobile()]],
    vehicleType: ['', Validators.maxLength(40)],
    plateNumber: ['', Validators.maxLength(20)],
    notes: ['', Validators.maxLength(500)],
    isActive: [true],
    password: ['', [Validators.required, passwordPolicyValidator()]],
    confirm: ['', [Validators.required, sameAsPasswordValidator()]],
  });

  protected readonly open = computed(() => !!this.driverId());
  protected readonly isNew = computed(() => this.driverId() === 'new');
  protected readonly current = signal<Driver | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly v = computed(() => ({ ...this.form.getRawValue(), ...this.draft() }));

  constructor() {
    effect(() => {
      const id = this.driverId();
      untracked(() => {
        if (id === 'new') this.resetForCreate();
        else if (id) this.load(id);
      });
    });

    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirm.updateValueAndValidity({ emitEvent: false }));
  }

  protected generate(): void {
    const pw = generatePassword();
    this.form.patchValue({ password: pw, confirm: pw });
    this.form.controls.password.markAsDirty();
    this.copy(pw, 'تم إنشاء كلمة مرور قوية ونسخها — أرسلها للمندوب');
  }

  protected copyPassword(): void {
    const pw = this.form.controls.password.value;
    if (pw) this.copy(pw, 'تم نسخ كلمة المرور');
  }

  protected close(): void {
    if (!this.saving()) this.closed.emit();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('راجع الحقول المطلوبة قبل الحفظ');
      return;
    }
    const v = this.form.getRawValue();
    const payload: DriverPayload = {
      name: v.name.trim(),
      phone: v.phone.trim(),
      vehicleType: v.vehicleType.trim(),
      plateNumber: v.plateNumber.trim(),
      notes: v.notes.trim(),
      isActive: v.isActive,
      ...(this.isNew() ? { password: v.password } : {}),
    };
    const id = this.current()?.id;
    this.saving.set(true);
    (id ? this.api.update(id, payload) : this.api.create(payload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (d) => {
          this.toast.success(id ? 'تم تحديث بيانات المندوب' : `تمت إضافة المندوب ${d.name} — يدخل التطبيق برقم ${toLocalMobile(d.phone)}`);
          this.saved.emit(d);
        },
        error: (err: ApiError) => this.onSaveError(err),
      });
  }

  private onSaveError(err: ApiError): void {
    if (hasErrorCode(err, DRIVER_ERROR_CODES.phoneTaken)) {
      const phone = this.form.controls.phone;
      phone.setErrors({ server: err.message || 'رقم الموبايل مسجل لمندوب آخر — استخدم رقمًا مختلفًا' });
      phone.markAsTouched();
      return;
    }
    const rest = applyServerErrors(this.form, err);
    if (rest || !err.fieldErrors) this.toast.error(rest ?? err.message);
  }

  private copy(text: string, message: string): void {
    copyToClipboard(text).then((ok) => (ok ? this.toast.info(message) : this.toast.warning('تعذّر النسخ — انسخ كلمة المرور يدويًا')));
  }

  private load(id: string): void {
    this.current.set(null);
    this.loading.set(true);
    this.setPasswordFieldsEnabled(false);
    this.api
      .get(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (d) => {
          this.current.set(d);
          this.form.reset({
            name: d.name,
            phone: toLocalMobile(d.phone),
            vehicleType: d.vehicleType ?? '',
            plateNumber: d.plateNumber ?? '',
            notes: d.notes ?? '',
            isActive: d.isActive,
            password: '',
            confirm: '',
          });
        },
        error: () => this.closed.emit(),
      });
  }

  private resetForCreate(): void {
    this.current.set(null);
    this.form.reset();
    this.setPasswordFieldsEnabled(true);
  }

  private setPasswordFieldsEnabled(on: boolean): void {
    for (const c of [this.form.controls.password, this.form.controls.confirm]) {
      if (on) c.enable({ emitEvent: false });
      else c.disable({ emitEvent: false });
    }
  }
}
