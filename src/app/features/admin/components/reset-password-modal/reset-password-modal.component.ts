import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { ApiError } from '../../../../core/models/api-response.model';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PasswordInputComponent } from '../../../../shared/components/password-input/password-input.component';
import { AdminUser, generatePassword } from '../../models/user.model';
import { UsersService } from '../../services/users.service';
import { passwordPolicyValidator, sameAsPasswordValidator } from '../../utils/password-policy.validator';
import { PasswordStrengthComponent } from '../password-strength/password-strength.component';

/** Admin sets a new password for a user (`user = null` → closed). */
@Component({
  selector: 'app-reset-password-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent, PasswordInputComponent, PasswordStrengthComponent],
  template: `
    <app-modal [open]="!!user()" [title]="'إعادة تعيين كلمة المرور — ' + (user()?.name ?? '')" size="md"
      [closeOnBackdrop]="!saving()" (closed)="close()">
      <form id="reset-pw-form" class="rp" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <p class="rp-lead">
          ستُستبدل كلمة المرور الحالية لـ <strong>{{ user()?.name }}</strong>
          (<span class="ltr">{{ user()?.email }}</span>). أبلغه بكلمة المرور الجديدة بطريقة آمنة.
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
      <div modal-footer class="rp-foot">
        <button type="button" class="ui-btn ui-btn--ghost rp-gen" (click)="generate()">
          <app-icon name="bolt" [size]="14" /> توليد ونسخ
        </button>
        <button type="button" class="ui-btn ui-btn--ghost" [disabled]="saving()" (click)="close()">إلغاء</button>
        <button type="submit" form="reset-pw-form" class="ui-btn ui-btn--primary" [class.is-loading]="saving()"
          [disabled]="saving()">
          <app-icon name="lock" [size]="15" /> تعيين كلمة المرور
        </button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .rp { display: flex; flex-direction: column; gap: 12px; }
      .rp-lead { margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--txt2); }
      .rp-foot { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; justify-content: flex-end; }
      .rp-gen { margin-inline-end: auto; }
    `,
  ],
})
export class ResetPasswordModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(UsersService);
  private readonly toast = inject(ToastService);

  readonly user = input<AdminUser | null>(null);
  readonly closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = this.fb.group({
    password: ['', [Validators.required, passwordPolicyValidator()]],
    confirm: ['', [Validators.required, sameAsPasswordValidator()]],
  });
  protected readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });

  constructor() {
    effect(() => {
      if (this.user()) untracked(() => this.form.reset());
    });
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirm.updateValueAndValidity({ emitEvent: false }));
  }

  protected generate(): void {
    const pw = generatePassword();
    this.form.setValue({ password: pw, confirm: pw });
    this.form.markAsDirty();
    navigator.clipboard?.writeText(pw).then(
      () => this.toast.info('تم نسخ كلمة المرور الجديدة للحافظة'),
      () => undefined,
    );
  }

  protected close(): void {
    if (!this.saving()) this.closed.emit();
  }

  protected submit(): void {
    const u = this.user();
    if (!u) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api
      .resetPassword(u.id, this.form.controls.password.value)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success(`تم تعيين كلمة مرور جديدة لـ ${u.name}`);
          this.closed.emit();
        },
        // 422 (password policy) → message under the password field.
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }
}
