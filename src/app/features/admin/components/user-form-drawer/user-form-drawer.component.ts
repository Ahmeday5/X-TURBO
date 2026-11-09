import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Permission, PERMISSIONS } from '../../../../core/auth/permissions';
import { Role, ROLES } from '../../../../core/auth/roles';
import { ToastService } from '../../../../core/services/toast.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DrawerComponent } from '../../../../shared/components/drawer/drawer.component';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PasswordInputComponent } from '../../../../shared/components/password-input/password-input.component';
import { formatDateTime } from '../../../../shared/utils/format.util';
import {
  AdminUser,
  generatePassword,
  normalizePermissions,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_VIEW,
  USER_ROLES,
  UserPayload,
} from '../../models/user.model';
import { UsersService } from '../../services/users.service';
import { passwordPolicyValidator, sameAsPasswordValidator } from '../../utils/password-policy.validator';
import { PasswordStrengthComponent } from '../password-strength/password-strength.component';
import { PermissionPickerComponent } from '../permission-picker/permission-picker.component';

const PHONE_PATTERN = /^0\d{8,10}$/;

/**
 * Create / edit a user in a side drawer. `userId` = `'new'` creates, an id
 * edits, `''` keeps it closed (the page binds it to a URL param).
 */
@Component({
  selector: 'app-user-form-drawer',
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
    PermissionPickerComponent,
  ],
  templateUrl: './user-form-drawer.component.html',
  styleUrl: './user-form-drawer.component.scss',
})
export class UserFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(UsersService);
  private readonly toast = inject(ToastService);

  readonly userId = input<string>('');
  /** The signed-in user — can't lock themselves out. */
  readonly selfId = input<string | null>(null);
  readonly activeAdmins = input(0);

  readonly closed = output<void>();
  readonly saved = output<AdminUser>();

  protected readonly roles = USER_ROLES;
  protected readonly roleView = ROLE_VIEW;
  protected readonly dateTime = formatDateTime;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(80)]],
    phone: ['', Validators.pattern(PHONE_PATTERN)],
    role: [ROLES.cashier as Role, Validators.required],
    permissions: [[...ROLE_DEFAULT_PERMISSIONS[ROLES.cashier]] as Permission[]],
    isActive: [true],
    password: ['', [Validators.required, passwordPolicyValidator()]],
    confirm: ['', [Validators.required, sameAsPasswordValidator()]],
  });

  protected readonly open = computed(() => !!this.userId());
  protected readonly isNew = computed(() => this.userId() === 'new');
  protected readonly current = signal<AdminUser | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly v = computed(() => ({ ...this.form.getRawValue(), ...this.draft() }));

  protected readonly isSelf = computed(() => !!this.current() && this.current()!.id === this.selfId());
  /** Editing the only active admin: role / status must stay. */
  protected readonly isLastAdmin = computed(() => {
    const c = this.current();
    return !!c && c.isActive && c.role === ROLES.admin && this.activeAdmins() <= 1;
  });
  protected readonly lockRoleAndStatus = computed(() => this.isSelf() || this.isLastAdmin());
  protected readonly lockedPermissions = computed<Permission[]>(() => (this.isSelf() ? [PERMISSIONS.users] : []));

  protected readonly isCustom = computed(() => {
    const v = this.v();
    const defaults = normalizePermissions(ROLE_DEFAULT_PERMISSIONS[v.role as Role] ?? []);
    return JSON.stringify(normalizePermissions(v.permissions ?? [])) !== JSON.stringify(defaults);
  });

  constructor() {
    effect(() => {
      const id = this.userId();
      untracked(() => {
        if (id === 'new') this.resetForCreate();
        else if (id) this.load(id);
      });
    });

    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirm.updateValueAndValidity({ emitEvent: false }));
  }

  protected pickRole(role: Role): void {
    if (this.lockRoleAndStatus() || this.form.controls.role.value === role) return;
    this.form.patchValue({ role, permissions: [...ROLE_DEFAULT_PERMISSIONS[role]] });
    this.form.markAsDirty();
  }

  protected restoreDefaults(): void {
    const role = this.form.controls.role.value;
    const next = new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role]);
    for (const p of this.lockedPermissions()) next.add(p);
    this.setPermissions([...next]);
  }

  protected setPermissions(list: Permission[]): void {
    this.form.controls.permissions.setValue(normalizePermissions(list));
    this.form.controls.permissions.markAsDirty();
  }

  protected generate(): void {
    const pw = generatePassword();
    this.form.patchValue({ password: pw, confirm: pw });
    this.form.controls.password.markAsDirty();
    navigator.clipboard?.writeText(pw).then(
      () => this.toast.info('تم إنشاء كلمة مرور قوية ونسخها للحافظة'),
      () => this.toast.info('تم إنشاء كلمة مرور قوية'),
    );
  }

  protected close(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('راجع الحقول المطلوبة قبل الحفظ');
      return;
    }
    const v = this.form.getRawValue();
    if (!v.permissions.length) {
      this.toast.warning('امنح المستخدم صلاحية واحدة على الأقل');
      return;
    }
    const payload: UserPayload = {
      name: v.name.trim(),
      email: v.email.trim().toLowerCase(),
      phone: v.phone.trim(),
      role: v.role,
      permissions: normalizePermissions(v.permissions),
      isActive: v.isActive,
      ...(this.isNew() ? { password: v.password } : {}),
    };
    const id = this.current()?.id;
    this.saving.set(true);
    (id ? this.api.update(id, payload) : this.api.create(payload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((u) => {
        this.toast.success(id ? 'تم تحديث بيانات المستخدم' : `تم إضافة المستخدم ${u.name}`);
        this.saved.emit(u);
      });
  }

  private load(id: string): void {
    this.current.set(null);
    this.loading.set(true);
    this.setPasswordFieldsEnabled(false);
    this.api
      .get(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (u) => {
          this.current.set(u);
          this.form.reset({
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            permissions: normalizePermissions(u.permissions),
            isActive: u.isActive,
            password: '',
            confirm: '',
          });
          if (this.lockRoleAndStatus()) this.form.controls.isActive.disable({ emitEvent: false });
          else this.form.controls.isActive.enable({ emitEvent: false });
        },
        error: () => this.closed.emit(),
      });
  }

  private resetForCreate(): void {
    this.current.set(null);
    this.form.reset();
    this.form.controls.isActive.enable({ emitEvent: false });
    this.setPasswordFieldsEnabled(true);
  }

  private setPasswordFieldsEnabled(on: boolean): void {
    for (const c of [this.form.controls.password, this.form.controls.confirm]) {
      if (on) c.enable({ emitEvent: false });
      else c.disable({ emitEvent: false });
    }
  }
}
