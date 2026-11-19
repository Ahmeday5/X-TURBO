import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PasswordInputComponent } from '../../../../shared/components/password-input/password-input.component';
import { toLocalMobile } from '../../../../shared/utils/phone.util';
import { PasswordStrengthComponent } from '../../../admin/components/password-strength/password-strength.component';
import { generatePassword } from '../../../admin/models/user.model';
import { passwordPolicyValidator, sameAsPasswordValidator } from '../../../admin/utils/password-policy.validator';
import { Driver } from '../../models/driver.model';
import { DriversService } from '../../services/drivers.service';
import { copyToClipboard } from '../../utils/clipboard.util';

/** Admin sets a new password for a driver (`driver = null` → closed). Signs them out everywhere. */
@Component({
  selector: 'app-driver-password-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent, PasswordInputComponent, PasswordStrengthComponent],
  template: `
    <app-modal [open]="!!driver()" [title]="'كلمة مرور جديدة — ' + (driver()?.name ?? '')" size="md"
      [closeOnBackdrop]="!saving()" (closed)="close()">
      <form id="driver-pw-form" class="dp" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <p class="dp-lead">
          ستُستبدل كلمة مرور <strong>{{ driver()?.name }}</strong> (<span class="ltr">{{ phone(driver()?.phone) }}</span>)
          وسيُسجَّل خروجه من كل الأجهزة. أرسل له كلمة المرور الجديدة بطريقة آمنة.
        </p>
        <div class="ui-field">
          <span class="ui-label is-required">كلمة المرور الجديدة</span>
          <app-password-input formControlName="password" autocomplete="new-password" placeholder="••••••••" />
          <app-form-error [control]="form.controls.password" label="كلمة المرور" />
        </div>
        <div class="ui-field">
          <span class="ui-label is-required">تأكيد كلمة المرور</span>
          <app-password-input formControlName="confirm" autocomplete="new-password" placeholder="••••••••" />
          <app-form-error [control]="form.controls.confirm" label="تأكيد كلمة المرور" />
        </div>
        <app-password-strength [value]="password()" />
      </form>
      <div modal-footer class="dp-foot">
        <button type="button" class="ui-btn ui-btn--ghost" (click)="generate()">
          <app-icon name="bolt" [size]="14" /> توليد ونسخ
        </button>
        <button type="button" class="ui-btn ui-btn--ghost dp-copy" [disabled]="!password()" (click)="copy()">
          <app-icon name="clipboard" [size]="14" /> نسخ
        </button>
        <button type="button" class="ui-btn ui-btn--ghost" [disabled]="saving()" (click)="close()">إلغاء</button>
        <button type="submit" form="driver-pw-form" class="ui-btn ui-btn--primary" [class.is-loading]="saving()" [disabled]="saving()">
          <app-icon name="lock" [size]="15" /> تعيين كلمة المرور
        </button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .dp { display: flex; flex-direction: column; gap: 12px; }
      .dp-lead { margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--txt2); }
      .dp-foot { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; justify-content: flex-end; }
      .dp-copy { margin-inline-end: auto; }
    `,
  ],
})
export class DriverPasswordModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(DriversService);
  private readonly toast = inject(ToastService);

  readonly driver = input<Driver | null>(null);
  readonly closed = output<void>();

  protected readonly phone = toLocalMobile;
  protected readonly saving = signal(false);
  protected readonly form = this.fb.group({
    password: ['', [Validators.required, passwordPolicyValidator()]],
    confirm: ['', [Validators.required, sameAsPasswordValidator()]],
  });
  protected readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });

  constructor() {
    effect(() => {
      if (this.driver()) untracked(() => this.form.reset());
    });
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirm.updateValueAndValidity({ emitEvent: false }));
  }

  protected generate(): void {
    const pw = generatePassword();
    this.form.setValue({ password: pw, confirm: pw });
    this.form.markAsDirty();
    void this.copyText(pw);
  }

  protected copy(): void {
    void this.copyText(this.form.controls.password.value);
  }

  protected close(): void {
    if (!this.saving()) this.closed.emit();
  }

  protected submit(): void {
    const d = this.driver();
    if (!d) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api
      .resetPassword(d.id, this.form.controls.password.value)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success(`تم تعيين كلمة مرور جديدة لـ ${d.name} وتسجيل خروجه من كل الأجهزة`);
          this.closed.emit();
        },
        // 422 (password policy) → message under the field; the interceptor already toasted the summary.
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }

  private async copyText(text: string): Promise<void> {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) this.toast.info('تم نسخ كلمة المرور للحافظة');
    else this.toast.warning('تعذّر النسخ — انسخ كلمة المرور يدويًا');
  }
}
