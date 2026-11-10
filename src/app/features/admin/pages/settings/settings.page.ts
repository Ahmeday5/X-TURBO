import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { formatDateTime } from '../../../../shared/utils/format.util';
import { AppValidators } from '../../../../shared/validators/app-validators';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import {
  HIDDEN_NUMBERING_KINDS,
  MONTHS_AR,
  NUMBERING_KINDS,
  NUMBERING_LABEL,
  NumberingKind,
  NumberingRule,
  previewNumber,
  SETTINGS_ERROR_CODES,
  SystemSettings,
  SystemSettingsPayload,
} from '../../models/settings.model';
import { SettingsService } from '../../services/settings.service';

/** One numbering row in the form (`kind` is fixed; the rest is editable). */
function numberingRow(fb: NonNullableFormBuilder, r: NumberingRule) {
  return fb.group({
    kind: fb.control<NumberingKind>(r.kind),
    prefix: fb.control(r.prefix, [Validators.required, AppValidators.docPrefix()]),
    nextNumber: fb.control(r.nextNumber, [Validators.required, Validators.min(1)]),
    digits: fb.control(r.digits, [Validators.required, Validators.min(1), Validators.max(10)]),
  });
}

type NumberingGroup = ReturnType<typeof numberingRow>;

/**
 * System settings: company profile (printed on every document), financial
 * defaults, document numbering and inventory rules. One record, saved as a
 * whole (`PUT /settings`). Gated by `Settings.Manage`.
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeaderComponent, IconComponent, FormErrorComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(SettingsService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  protected readonly warehouses = toSignal(inject(WarehousesService).lookup(), { initialValue: [] });
  protected readonly months = MONTHS_AR;
  protected readonly dateTime = formatDateTime;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly current = signal<SystemSettings | null>(null);
  /** Server refused the numbering (409 NUMBER_COLLISION) — shown inside that section. */
  protected readonly numberingError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    company: this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      taxNumber: ['', AppValidators.taxNumber()],
      commercialRegister: ['', Validators.maxLength(30)],
      phone: ['', AppValidators.phone()],
      email: ['', [AppValidators.email(), Validators.maxLength(120)]],
      address: ['', Validators.maxLength(250)],
      logoInitials: ['', [Validators.required, Validators.maxLength(3)]],
    }),
    financial: this.fb.group({
      baseCurrency: [{ value: 'EGP' as const, disabled: true }],
      vatRate: [14, [Validators.required, Validators.min(0), Validators.max(100)]],
      pricesIncludeTax: [false],
      fiscalYearStartMonth: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
      decimalPlaces: [2, [Validators.required, Validators.min(0), Validators.max(4)]],
    }),
    numbering: this.fb.array<NumberingGroup>([]),
    inventory: this.fb.group({
      allowNegativeStock: [false],
      lowStockThreshold: [5, [Validators.required, Validators.min(0)]],
      defaultWarehouseId: [''],
    }),
  });

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected get numbering(): FormArray<NumberingGroup> {
    return this.form.controls.numbering;
  }

  /** Numbering rows grouped by business area (المبيعات / المشتريات / …), keeping their form index. */
  protected readonly numberingGroups = computed(() => {
    this.draft();
    const groups = new Map<string, { index: number; kind: NumberingKind }[]>();
    this.numbering.controls.forEach((g, index) => {
      const kind = g.controls.kind.value;
      if (HIDDEN_NUMBERING_KINDS.has(kind)) return;
      const group = (NUMBERING_LABEL as Partial<Record<string, { group: string }>>)[kind]?.group ?? 'أخرى';
      groups.set(group, [...(groups.get(group) ?? []), { index, kind }]);
    });
    return [...groups.entries()].map(([label, rows]) => ({ label, rows }));
  });

  /** Letterhead preview (top of every printed document). */
  protected readonly letterhead = computed(() => {
    this.draft();
    const c = this.form.controls.company.getRawValue();
    return {
      initials: (c.logoInitials || c.name.slice(0, 2) || '—').toUpperCase(),
      name: c.name || 'اسم الشركة',
      lines: [
        c.address,
        [c.phone, c.email].filter(Boolean).join(' · '),
        [c.taxNumber && `ر.ض ${c.taxNumber}`, c.commercialRegister && `س.ت ${c.commercialRegister}`].filter(Boolean).join(' · '),
      ].filter(Boolean),
    };
  });

  constructor() {
    this.api
      .get()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((s) => this.apply(s));

    // A numbering edit invalidates the collision notice.
    this.numbering.valueChanges.subscribe(() => this.numberingError.set(null));
  }

  /** Arabic name of a numbering kind; falls back to the raw kind for kinds this UI doesn't know yet. */
  protected kindLabel(kind: string): string {
    return (NUMBERING_LABEL as Partial<Record<string, { label: string }>>)[kind]?.label ?? kind;
  }

  protected preview(index: number): string {
    const g = this.numbering.at(index)?.getRawValue();
    return g ? previewNumber(g.prefix, g.nextNumber, g.digits) : '';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('راجع الحقول المطلوبة قبل الحفظ');
      return;
    }
    const v = this.form.getRawValue();
    const payload: SystemSettingsPayload = {
      company: {
        ...v.company,
        name: v.company.name.trim(),
        email: v.company.email.trim(),
        logoInitials: v.company.logoInitials.trim().toUpperCase(),
      },
      financial: {
        baseCurrency: 'EGP',
        vatRate: Number(v.financial.vatRate),
        pricesIncludeTax: v.financial.pricesIncludeTax,
        fiscalYearStartMonth: Number(v.financial.fiscalYearStartMonth),
        decimalPlaces: Number(v.financial.decimalPlaces),
      },
      numbering: v.numbering.map((r) => ({
        kind: r.kind,
        prefix: r.prefix.trim().toUpperCase(),
        nextNumber: Math.floor(Number(r.nextNumber)),
        digits: Math.floor(Number(r.digits)),
      })),
      inventory: {
        allowNegativeStock: v.inventory.allowNegativeStock,
        lowStockThreshold: Number(v.inventory.lowStockThreshold),
        defaultWarehouseId: v.inventory.defaultWarehouseId || null,
      },
    };

    this.numberingError.set(null);
    this.saving.set(true);
    this.api
      .save(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (s) => {
          this.apply(s);
          this.toast.success('تم حفظ الإعدادات');
        },
        error: (err: ApiError) => {
          // 409: the new numbering would issue a number that already exists.
          if (hasErrorCode(err, SETTINGS_ERROR_CODES.numberCollision)) this.numberingError.set(err.message);
          // 422: `company.name`, `numbering[3].prefix`, … → under each field.
          applyServerErrors(this.form, err);
        },
      });
  }

  protected reset(): void {
    const s = this.current();
    if (s) this.apply(s);
  }

  private apply(s: SystemSettings): void {
    this.current.set(s);
    this.numberingError.set(null);

    // Known kinds in a stable order, then anything new the server sends.
    const byKind = new Map(s.numbering.map((r) => [r.kind, r]));
    const ordered: NumberingRule[] = [
      ...NUMBERING_KINDS.filter((k) => byKind.has(k)).map((k) => byKind.get(k)!),
      ...s.numbering.filter((r) => !NUMBERING_KINDS.includes(r.kind)),
    ];
    this.numbering.clear({ emitEvent: false });
    for (const r of ordered) this.numbering.push(numberingRow(this.fb, r), { emitEvent: false });

    this.form.reset({
      company: { ...s.company },
      financial: { ...s.financial },
      numbering: ordered.map((r) => ({ ...r })),
      inventory: { ...s.inventory, defaultWarehouseId: s.inventory.defaultWarehouseId ?? '' },
    });
  }
}
