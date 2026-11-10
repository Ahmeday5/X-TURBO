import { ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { ApiError } from '../../../../core/models/api-response.model';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import { todayIsoDate } from '../../../../shared/utils/date-iso.util';
import { formatMoney } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import {
  CounterpartyType,
  Voucher,
  VOUCHER_KIND_CONFIG,
  VOUCHER_METHOD_LABEL,
  VOUCHER_METHODS,
  VoucherKind,
  VoucherMethod,
  VoucherPayload,
} from '../../models/voucher.model';
import { VouchersService } from '../../services/vouchers.service';
import { injectVoucherLookups } from '../../utils/voucher-lookups';
import { cashSideLabel, JOURNAL_LINES_PLURAL, newVoucherLabel, VOUCHER_KIND_ICON } from '../../utils/voucher-view';

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type LineGroup = FormGroup<{
  accountId: FormControl<string>;
  costCenterId: FormControl<string>;
  note: FormControl<string>;
  debit: FormControl<number | null>;
  credit: FormControl<number | null>;
}>;

/**
 * Create / edit a draft voucher. Receipt & payment: one amount between a
 * cash/bank account and a party or counter account. Journal: free balanced
 * double-entry lines. `voucherId` = 'new' → create.
 * Emits `saved` with the stored voucher, or `locked` when asked to edit a
 * voucher that is no longer a draft.
 */
@Component({
  selector: 'app-voucher-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, FormErrorComponent, SearchableSelectComponent],
  templateUrl: './voucher-editor.component.html',
  styleUrl: './voucher-editor.component.scss',
})
export class VoucherEditorComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly vouchers = inject(VouchersService);
  private readonly toast = inject(ToastService);

  readonly kind = input.required<VoucherKind>();
  readonly voucherId = input.required<string>();

  readonly closed = output<void>();
  readonly saved = output<Voucher>();
  readonly locked = output<string>();

  protected readonly cfg = computed(() => VOUCHER_KIND_CONFIG[this.kind()]);
  protected readonly icon = computed(() => VOUCHER_KIND_ICON[this.kind()]);
  protected readonly isJournal = computed(() => this.kind() === 'journal');
  protected readonly isNew = computed(() => this.voucherId() === 'new');
  protected readonly title = computed(() => (this.isNew() ? newVoucherLabel(this.kind()) : `تعديل ${this.cfg().singular}`));
  protected readonly cashLabel = computed(() => cashSideLabel(this.kind()));
  protected readonly methods = VOUCHER_METHODS;
  protected readonly methodLabel = VOUCHER_METHOD_LABEL;

  protected readonly form = this.fb.group({
    date: [todayIsoDate(), Validators.required],
    description: ['', Validators.maxLength(300)],
    reference: ['', Validators.maxLength(80)],
    counterpartyType: ['party' as CounterpartyType],
    partyId: [''],
    accountId: [''],
    cashAccountId: [''],
    method: ['cash' as VoucherMethod],
    amount: [null as number | null],
    costCenterId: [''],
    lines: this.fb.array<LineGroup>([]),
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private readonly value = computed(() => {
    this.values();
    return this.form.getRawValue();
  });

  protected readonly current = signal<Voucher | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal<'draft' | 'post' | null>(null);
  protected readonly submitted = signal(false);

  // ── Lookups ──

  protected readonly lookups = injectVoucherLookups();
  protected readonly cashOptions = computed<SearchableSelectOption[]>(() =>
    this.lookups.cashAccounts().map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
  );
  protected readonly centerOptions = computed<SearchableSelectOption[]>(() =>
    this.lookups.centers().map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
  );
  private readonly accountMap = computed(() => new Map(this.lookups.accounts().map((a) => [a.id, a])));

  protected readonly party = computed(() => {
    const v = this.value();
    return v.counterpartyType === 'party' ? (this.lookups.parties().find((p) => p.id === v.partyId) ?? null) : null;
  });
  protected readonly counterAccount = computed(() => {
    const v = this.value();
    return v.counterpartyType === 'account' ? (this.accountMap().get(v.accountId) ?? null) : null;
  });
  protected readonly cashAccount = computed(() => this.accountMap().get(this.value().cashAccountId) ?? null);
  protected readonly needsCenter = computed(() => !!this.counterAccount()?.costCenterRequired && !this.value().costCenterId);
  protected readonly counterpartyLabel = computed(() => {
    const v = this.value();
    return v.counterpartyType === 'party' ? (this.party()?.name ?? null) : this.counterAccount() ? `${this.counterAccount()!.code} — ${this.counterAccount()!.name}` : null;
  });
  protected readonly amount = computed(() => round2(num(this.value().amount)));

  // ── Journal ──

  protected get lines() {
    return this.form.controls.lines;
  }

  protected readonly totals = computed(() => {
    const lines = this.value().lines;
    const debit = round2(lines.reduce((s, l) => s + num(l.debit), 0));
    const credit = round2(lines.reduce((s, l) => s + num(l.credit), 0));
    return { debit, credit, diff: round2(debit - credit) };
  });

  /** Per-line problems (index → message), shown inline once the user tried to save. */
  protected readonly lineIssues = computed(() => {
    const issues = new Map<number, string>();
    this.value().lines.forEach((l, i) => {
      const d = num(l.debit);
      const c = num(l.credit);
      const acc = this.accountMap().get(l.accountId);
      if (!l.accountId) issues.set(i, 'اختر الحساب');
      else if (d < 0 || c < 0) issues.set(i, 'لا تُقبل القيم السالبة');
      else if (d > 0 && c > 0) issues.set(i, 'مدين أو دائن — وليس الاثنين');
      else if (!(d > 0) && !(c > 0)) issues.set(i, 'أدخل مبلغًا مدينًا أو دائنًا');
      else if (acc?.costCenterRequired && !l.costCenterId) issues.set(i, 'هذا الحساب يتطلب مركز تكلفة');
    });
    return issues;
  });

  /** Why the journal can't be saved yet (null = balanced & valid). */
  protected readonly journalProblem = computed(() => {
    const lines = this.value().lines;
    const t = this.totals();
    if (lines.length < 2) return 'القيد يحتاج إلى سطرين على الأقل';
    if (this.lineIssues().size) return `راجع السطر ${[...this.lineIssues().keys()][0] + 1}: ${[...this.lineIssues().values()][0]}`;
    if (!(t.debit > 0)) return 'أدخل مبالغ القيد';
    if (t.diff !== 0) return 'القيد غير متزن — يجب أن يتساوى المدين والدائن';
    return null;
  });
  protected readonly balanced = computed(() => this.totals().debit > 0 && this.totals().diff === 0);
  protected readonly linesLabel = computed(() => pluralAr(this.value().lines.length, JOURNAL_LINES_PLURAL));
  protected readonly requiresCenter = (accountId: string) => !!this.accountMap().get(accountId)?.costCenterRequired;

  protected readonly money = formatMoney;
  protected readonly abs = Math.abs;

  constructor() {
    effect(() => {
      const id = this.voucherId();
      const kind = this.kind();
      untracked(() => (id === 'new' ? this.reset(kind) : this.load(id)));
    });

    // Default cash box once the lookup arrives (create mode).
    effect(() => {
      const list = this.lookups.cashAccounts();
      untracked(() => {
        const ctrl = this.form.controls.cashAccountId;
        if (!ctrl.value && list.length && !this.isJournal() && this.isNew()) ctrl.setValue(list[0].id);
      });
    });

    // User picked another cash box / bank → suggest the matching method.
    this.form.controls.cashAccountId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      if (this.form.controls.cashAccountId.dirty) this.onCashChange(id);
    });
  }

  @HostListener('document:keydown.control.s', ['$event'])
  protected onSaveShortcut(event: Event): void {
    event.preventDefault();
    if (!this.saving()) this.submit(false);
  }

  // ── Counterparty ──

  protected setCounterpartyType(type: CounterpartyType): void {
    this.form.patchValue({ counterpartyType: type, partyId: '', accountId: '' });
  }

  /** Bank account → default to a transfer, cash box → cash (only while still on a default). */
  private onCashChange(id: string | null): void {
    const acc = id ? this.accountMap().get(id) : null;
    const method = this.form.controls.method;
    if (!acc) return;
    if (acc.code === '1101' && method.value === 'bank') method.setValue('cash');
    else if (acc.code !== '1101' && method.value === 'cash') method.setValue('bank');
  }

  // ── Lines ──

  private newLine(l?: Partial<{ accountId: string; costCenterId: string; note: string; debit: number; credit: number }>): LineGroup {
    return this.fb.group({
      accountId: [l?.accountId ?? ''],
      costCenterId: [l?.costCenterId ?? ''],
      note: [l?.note ?? '', Validators.maxLength(200)],
      debit: [l?.debit ? l.debit : (null as number | null)],
      credit: [l?.credit ? l.credit : (null as number | null)],
    });
  }

  protected addLine(): void {
    // Pre-fill the amount that balances the entry.
    const diff = this.totals().diff;
    const line = this.newLine(diff > 0 ? { credit: diff } : diff < 0 ? { debit: -diff } : undefined);
    this.lines.push(line);
  }

  protected removeLine(i: number): void {
    this.lines.removeAt(i);
  }

  /**
   * First server message on a journal line (422 `lines[i].debit` etc. are
   * set on the line's controls by `applyServerErrors`; cleared on edit).
   */
  protected serverLineError(line: AbstractControl): string | null {
    const controls = (line as FormGroup).controls ?? {};
    for (const control of Object.values(controls)) {
      const message = control.errors?.['server'];
      if (typeof message === 'string') return message;
    }
    return null;
  }

  /** Typing a debit clears the credit of the same line, and vice versa. */
  protected onAmount(i: number, side: 'debit' | 'credit'): void {
    const g = this.lines.at(i);
    const other = side === 'debit' ? g.controls.credit : g.controls.debit;
    if (num(g.controls[side].value) > 0 && other.value) other.setValue(null);
  }

  /** Put the remaining difference on this line. */
  protected balanceOn(i: number): void {
    const g = this.lines.at(i);
    const diff = this.totals().diff;
    const d = num(g.controls.debit.value);
    const c = num(g.controls.credit.value);
    const net = round2(d - c - diff);
    g.patchValue(net >= 0 ? { debit: net || null, credit: null } : { debit: null, credit: -net });
  }

  // ── Save ──

  protected submit(post: boolean): void {
    this.submitted.set(true);
    const v = this.form.getRawValue();
    const kind = this.kind();
    const cfg = this.cfg();

    const problem = this.form.invalid
      ? 'راجع الحقول المطلوبة'
      : kind === 'journal'
        ? !v.description.trim()
          ? 'اكتب بيان القيد'
          : this.journalProblem()
        : !(this.amount() > 0)
          ? 'المبلغ يجب أن يكون أكبر من صفر'
          : !v.cashAccountId
            ? 'اختر الخزينة أو البنك'
            : v.counterpartyType === 'party' && !v.partyId
              ? kind === 'receipt'
                ? 'حدد الجهة المقبوض منها'
                : 'حدد الجهة المصروف إليها'
              : v.counterpartyType === 'account' && !v.accountId
                ? 'اختر الحساب المقابل'
                : this.needsCenter()
                  ? 'الحساب المقابل يتطلب مركز تكلفة'
                  : null;
    if (problem) {
      this.form.markAllAsTouched();
      this.toast.warning(problem);
      return;
    }

    const journal = kind === 'journal';
    const payload: VoucherPayload = {
      kind,
      date: v.date,
      description: v.description.trim(),
      reference: v.reference.trim(),
      counterpartyType: journal ? null : v.counterpartyType,
      partyId: !journal && v.counterpartyType === 'party' ? v.partyId : null,
      accountId: !journal && v.counterpartyType === 'account' ? v.accountId : null,
      cashAccountId: journal ? null : v.cashAccountId,
      method: journal ? null : v.method,
      amount: journal ? this.totals().debit : this.amount(),
      costCenterId: journal ? null : v.costCenterId || null,
      lines: journal
        ? v.lines.map((l) => ({
            accountId: l.accountId,
            debit: round2(num(l.debit)),
            credit: round2(num(l.credit)),
            costCenterId: l.costCenterId || null,
            note: l.note.trim(),
          }))
        : [],
      post,
    };

    const id = this.current()?.id;
    this.saving.set(post ? 'post' : 'draft');
    (id ? this.vouchers.update(id, payload) : this.vouchers.create(payload))
      .pipe(finalize(() => this.saving.set(null)))
      .subscribe({
        next: (saved) => {
          this.toast.success(post ? `تم ترحيل ${cfg.singular} ${saved.number}` : `تم حفظ ${saved.number} كمسودة`);
          this.saved.emit(saved);
        },
        // 422 → header fields and journal lines (`lines[i].debit` → that line's control).
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }

  // ── Load / reset ──

  private load(id: string): void {
    this.loading.set(true);
    this.vouchers
      .get(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (v) => {
          if (v.status !== 'draft') {
            this.toast.info(`${v.number} ${v.status === 'posted' ? 'مُرحّل' : 'ملغي'} — لا يمكن تعديله`);
            this.locked.emit(v.id);
            return;
          }
          this.current.set(v);
          this.lines.clear({ emitEvent: false });
          for (const l of v.lines) {
            this.lines.push(this.newLine({ accountId: l.accountId, costCenterId: l.costCenterId ?? '', note: l.note, debit: l.debit, credit: l.credit }), { emitEvent: false });
          }
          this.form.reset({
            date: v.date,
            description: v.description,
            reference: v.reference,
            counterpartyType: v.counterpartyType ?? 'party',
            partyId: v.partyId ?? '',
            accountId: v.accountId ?? '',
            cashAccountId: v.cashAccountId ?? '',
            method: v.method ?? 'cash',
            amount: v.amount || null,
            costCenterId: v.costCenterId ?? '',
          });
          this.submitted.set(false);
        },
        error: () => this.closed.emit(),
      });
  }

  private reset(kind: VoucherKind): void {
    this.current.set(null);
    this.submitted.set(false);
    this.lines.clear({ emitEvent: false });
    if (kind === 'journal') {
      this.lines.push(this.newLine(), { emitEvent: false });
      this.lines.push(this.newLine(), { emitEvent: false });
    }
    this.form.reset({
      date: todayIsoDate(),
      description: '',
      reference: '',
      counterpartyType: kind === 'payment' ? 'account' : 'party',
      partyId: '',
      accountId: '',
      cashAccountId: kind === 'journal' ? '' : (this.lookups.cashAccounts()[0]?.id ?? ''),
      method: 'cash',
      amount: null,
      costCenterId: '',
    });
  }
}
