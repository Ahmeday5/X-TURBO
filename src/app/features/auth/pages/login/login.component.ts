import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ApiError } from '../../../../core/models/api-response.model';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PasswordInputComponent } from '../../../../shared/components/password-input/password-input.component';
import { DEFAULT_AUTHENTICATED_ROUTE } from '../../../../core/auth/auth.config';
import { environment } from '../../../../../environments/environment';
import { FormShake } from '../../utils/form-shake';
import { DEMO_ACCOUNTS, DemoAccount } from '../../../../mock';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormErrorComponent, IconComponent, PasswordInputComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly appName = environment.appName;
  /** Empty in production builds (see mock/index.prod.ts). */
  protected readonly demoAccounts = DEMO_ACCOUNTS;

  /** Drives the in-button spinner — independent of the global page loader. */
  protected readonly isSubmitting = signal(false);
  /** Inline error displayed inside the form (no global toast for credential errors). */
  protected readonly serverError = signal<string | null>(null);
  protected readonly shake = new FormShake();
  protected readonly capsLock = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [true],
  });

  protected isInvalid(field: 'email' | 'password'): boolean {
    const ctrl = this.form.controls[field];
    return ctrl.invalid && ctrl.touched;
  }

  protected useDemoAccount(account: DemoAccount): void {
    this.form.patchValue({ email: account.email, password: account.password });
    this.serverError.set(null);
  }

  protected onPasswordKey(event: KeyboardEvent): void {
    this.capsLock.set(event.getModifierState?.('CapsLock') ?? false);
  }

  protected onSubmit(): void {
    if (this.isSubmitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.shake.play();
      return;
    }

    const { email, password, rememberMe } = this.form.getRawValue();

    this.serverError.set(null);
    this.isSubmitting.set(true);

    this.auth.login({ email, password, rememberMe }).subscribe({
      next: (user) => {
        this.isSubmitting.set(false);
        this.toast.success(`أهلًا بعودتك، ${user.name}`);
        this.router.navigateByUrl(this.resolveReturnUrl());
      },
      error: (err: ApiError) => {
        this.isSubmitting.set(false);
        this.serverError.set(err.message);
        this.shake.play();
      },
    });
  }

  private resolveReturnUrl(): string {
    const target = this.route.snapshot.queryParamMap.get('returnUrl');
    if (target && target.startsWith('/') && !target.startsWith('//')) {
      return target;
    }
    return DEFAULT_AUTHENTICATED_ROUTE;
  }
}
