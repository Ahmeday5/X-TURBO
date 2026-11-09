import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../../core/services/toast.service';
import { AvatarComponent } from '../../../../../shared/components/avatar/avatar.component';
import { DrawerComponent } from '../../../../../shared/components/drawer/drawer.component';
import { FormErrorComponent } from '../../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../../../shared/components/searchable-select/searchable-select.component';
import { formatMoney } from '../../../../../shared/utils/format.util';
import { CostCenterOption } from '../../../models/cost-center.model';
import { Employee, EMPLOYEE_STATUS_VIEW, EMPLOYEE_STATUSES, EmployeePayload, EmployeeStatus } from '../../../models/employee.model';
import { AccountsService } from '../../../services/accounts.service';
import { EmployeesService } from '../../../services/employees.service';

const PHONE = /^01[0125]\d{8}$/;

function phoneValidator(c: AbstractControl<string>): ValidationErrors | null {
  const v = (c.value ?? '').replace(/\s+/g, '');
  return !v || PHONE.test(v) ? null : { phone: true };
}

function nationalIdValidator(c: AbstractControl<string>): ValidationErrors | null {
  const v = (c.value ?? '').trim();
  return !v || /^\d{14}$/.test(v) ? null : { nationalId: 'الرقم القومي يجب أن يتكون من 14 رقمًا' };
}

const today = (): string => new Date().toISOString().slice(0, 10);

const birthFormat = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });

/** Birth date encoded in an Egyptian national ID (C YY MM DD …), or null. */
function birthFromNationalId(id: string): string | null {
  if (!/^[23]\d{13}$/.test(id)) return null;
  const year = (id[0] === '2' ? 1900 : 2000) + Number(id.slice(1, 3));
  const month = Number(id.slice(3, 5));
  const day = Number(id.slice(5, 7));
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return birthFormat.format(d);
}

/** Create / edit an employee card in a side drawer. */
@Component({
  selector: 'app-employee-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AvatarComponent, DrawerComponent, FormErrorComponent, IconComponent, SearchableSelectComponent],
  templateUrl: './employee-editor.component.html',
  styleUrl: './employee-editor.component.scss',
})
export class EmployeeEditorComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(EmployeesService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  /** `null` → new employee. */
  readonly employee = input<Employee | null>(null);
  readonly centers = input<readonly CostCenterOption[]>([]);
  readonly closed = output<void>();
  readonly saved = output<Employee>();

  private readonly accountLookup = toSignal(inject(AccountsService).lookup({ leaf: true, type: 'asset' }), { initialValue: [] });

  protected readonly statuses = EMPLOYEE_STATUSES;
  protected readonly statusView = EMPLOYEE_STATUS_VIEW;
  protected readonly money = formatMoney;
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    jobTitle: ['', Validators.maxLength(60)],
    costCenterId: [''],
    phone: ['', phoneValidator],
    nationalId: ['', nationalIdValidator],
    hireDate: [today(), Validators.required],
    salary: [0, [Validators.required, Validators.min(0), Validators.max(10_000_000)]],
    advancesAccountId: [''],
    status: ['active' as EmployeeStatus, Validators.required],
    notes: ['', Validators.maxLength(300)],
  });

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly value = computed(() => ({ ...this.form.getRawValue(), ...this.draft() }));

  protected readonly isEdit = computed(() => !!this.employee());

  protected readonly centerOptions = computed<SearchableSelectOption[]>(() => {
    const opts: SearchableSelectOption[] = this.centers().map((c) => ({ value: c.id, label: c.name, hint: c.code }));
    // Keep the current department selectable even if it was deactivated since.
    const e = this.employee();
    if (e?.costCenterId && !opts.some((o) => o.value === e.costCenterId)) {
      opts.unshift({ value: e.costCenterId, label: e.costCenterName ?? e.costCenterId, hint: 'موقوف' });
    }
    return [{ value: '', label: '— بدون قسم —' }, ...opts];
  });

  protected readonly accountOptions = computed<SearchableSelectOption[]>(() => {
    const opts: SearchableSelectOption[] = this.accountLookup().map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));
    const e = this.employee();
    if (e?.advancesAccountId && !opts.some((o) => o.value === e.advancesAccountId)) {
      opts.unshift({ value: e.advancesAccountId, label: e.advancesAccountName ?? e.advancesAccountId });
    }
    return [{ value: '', label: '— بدون حساب سلف —' }, ...opts];
  });

  protected readonly center = computed(() => this.centers().find((c) => c.id === this.value().costCenterId) ?? null);
  protected readonly birth = computed(() => birthFromNationalId((this.value().nationalId ?? '').trim()));

  constructor() {
    effect(() => {
      const open = this.open();
      const e = this.employee();
      if (open) untracked(() => this.reset(e));
    });
  }

  protected setStatus(s: EmployeeStatus): void {
    this.form.controls.status.setValue(s);
    this.form.controls.status.markAsDirty();
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('راجع الحقول المطلوبة قبل الحفظ');
      return;
    }
    const v = this.form.getRawValue();
    const payload: EmployeePayload = {
      name: v.name.trim(),
      jobTitle: v.jobTitle.trim(),
      costCenterId: v.costCenterId || null,
      phone: v.phone.replace(/\s+/g, ''),
      nationalId: v.nationalId.trim(),
      hireDate: v.hireDate,
      salary: Math.round(Number(v.salary) || 0),
      advancesAccountId: v.advancesAccountId || null,
      status: v.status,
      notes: v.notes.trim(),
    };
    const id = this.employee()?.id;
    this.saving.set(true);
    (id ? this.api.update(id, payload) : this.api.create(payload)).pipe(finalize(() => this.saving.set(false))).subscribe((emp) => {
      this.toast.success(id ? 'تم تحديث بيانات الموظف' : `تم إضافة الموظف ${emp.code} — ${emp.name}`);
      this.saved.emit(emp);
    });
  }

  private reset(e: Employee | null): void {
    this.form.reset(
      e
        ? {
            name: e.name,
            jobTitle: e.jobTitle,
            costCenterId: e.costCenterId ?? '',
            phone: e.phone,
            nationalId: e.nationalId,
            hireDate: (e.hireDate ?? '').slice(0, 10) || today(),
            salary: e.salary,
            advancesAccountId: e.advancesAccountId ?? '',
            status: e.status,
            notes: e.notes,
          }
        : { hireDate: today() },
    );
  }
}
