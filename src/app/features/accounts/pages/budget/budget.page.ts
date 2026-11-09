import { ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import { SummaryTile, SummaryTilesComponent } from '../../../../shared/components/summary-tiles/summary-tiles.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { downloadCsv } from '../../../../shared/utils/csv.util';
import { formatDateTime, formatMoney, formatMoneyCompact, formatPercent } from '../../../../shared/utils/format.util';
import { BudgetChartComponent, BudgetChartMonth } from '../../components/budget-chart/budget-chart.component';
import {
  Budget,
  BudgetLine,
  BudgetPayload,
  elapsedMonths,
  favourableVariance,
  MONTH_LABELS,
  sumOf,
} from '../../models/budget.model';
import { BudgetService } from '../../services/budget.service';
import { CostCentersService } from '../../services/cost-centers.service';

type LineType = BudgetLine['type'];

interface RowView {
  line: BudgetLine;
  annual: number;
  plannedToDate: number;
  actualToDate: number;
  variance: number;
  /** Variance as % of planned-to-date (null when nothing was planned). */
  variancePct: number | null;
}

interface Totals {
  planned: number[];
  actual: number[];
  annual: number;
  plannedToDate: number;
  actualToDate: number;
  variance: number;
}

const SECTION_LABEL: Record<LineType, string> = { revenue: 'الإيرادات', expense: 'المصروفات' };

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Splits `total` over 12 months in whole cents; the remainder goes to the last months. */
function spreadEvenly(total: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.trunc(cents / 12);
  const rest = cents - base * 12;
  return Array.from({ length: 12 }, (_, i) => (base + (i >= 12 - Math.abs(rest) ? Math.sign(rest) : 0)) / 100);
}

/**
 * Estimated budget: planned amounts per revenue / expense account per month,
 * edited in a grid against actual postings. `?year=` and `?costCenterId=`
 * live in the URL; edits are kept locally until saved.
 */
@Component({
  selector: 'app-budget-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, PageHeaderComponent, SearchableSelectComponent, SummaryTilesComponent, BudgetChartComponent],
  templateUrl: './budget.page.html',
  styleUrl: './budget.page.scss',
})
export class BudgetPage {
  private readonly api = inject(BudgetService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Bound from route data / query string. */
  readonly navId = input.required<string>();
  readonly yearParam = input<string>('', { alias: 'year' });
  readonly costCenterParam = input<string>('', { alias: 'costCenterId' });

  private readonly thisYear = new Date().getFullYear();
  protected readonly years = [this.thisYear - 2, this.thisYear - 1, this.thisYear, this.thisYear + 1];
  protected readonly months = MONTH_LABELS;
  protected readonly monthIdx = MONTH_LABELS.map((_, i) => i);
  protected readonly sectionLabel = SECTION_LABEL;
  protected readonly sections: readonly LineType[] = ['revenue', 'expense'];
  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;

  protected readonly year = computed(() => {
    const y = Number(this.yearParam());
    return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : this.thisYear;
  });
  protected readonly costCenterId = computed(() => this.costCenterParam() || null);
  protected readonly elapsed = computed(() => elapsedMonths(this.year()));

  private readonly query = computed(() => ({ year: this.year(), costCenterId: this.costCenterId() }), {
    equal: (a, b) => a.year === b.year && a.costCenterId === b.costCenterId,
  });
  protected readonly budget = createQueryResource(this.query, (q) => this.api.get(q.year, q.costCenterId), {
    errorMessage: 'تعذّر تحميل الموازنة',
  });

  protected readonly centers = toSignal(inject(CostCentersService).lookup(), { initialValue: [] });
  protected readonly centerName = computed(() => {
    const id = this.costCenterId();
    return id ? (this.centers().find((c) => c.id === id)?.name ?? '') : 'الشركة ككل';
  });

  // ── Draft ──

  /** Every leaf account the server knows for this budget (planned values as saved). */
  protected readonly source = signal<Budget | null>(null);
  /** Lines currently in the grid, with edited planned values. */
  protected readonly draft = signal<BudgetLine[]>([]);
  private readonly baseline = signal('');
  protected readonly saving = signal(false);

  private readonly payload = computed<BudgetPayload>(() => ({
    costCenterId: this.costCenterId(),
    lines: this.draft()
      .filter((l) => l.planned.some((v) => v !== 0))
      .map((l) => ({ accountId: l.accountId, planned: l.planned }))
      .sort((a, b) => a.accountId.localeCompare(b.accountId)),
  }));
  protected readonly dirty = computed(() => !!this.source() && JSON.stringify(this.payload()) !== this.baseline());

  protected readonly rows = computed(() => {
    const elapsed = this.elapsed();
    const out: Record<LineType, RowView[]> = { revenue: [], expense: [] };
    for (const line of this.draft()) {
      const plannedToDate = sumOf(line.planned.slice(0, elapsed));
      const actualToDate = sumOf(line.actual);
      const variance = favourableVariance(line.type, plannedToDate, actualToDate);
      out[line.type].push({
        line,
        annual: sumOf(line.planned),
        plannedToDate,
        actualToDate,
        variance,
        variancePct: plannedToDate ? (variance / Math.abs(plannedToDate)) * 100 : null,
      });
    }
    return out;
  });

  protected readonly totals = computed<Record<LineType, Totals>>(() => {
    const t = (rows: RowView[]): Totals => ({
      planned: this.monthIdx.map((m) => sumOf(rows.map((r) => r.line.planned[m]))),
      actual: this.monthIdx.map((m) => sumOf(rows.map((r) => r.line.actual[m]))),
      annual: sumOf(rows.map((r) => r.annual)),
      plannedToDate: sumOf(rows.map((r) => r.plannedToDate)),
      actualToDate: sumOf(rows.map((r) => r.actualToDate)),
      variance: sumOf(rows.map((r) => r.variance)),
    });
    const rows = this.rows();
    return { revenue: t(rows.revenue), expense: t(rows.expense) };
  });

  /** Revenue − expense; its favourable variance is actual net − planned net. */
  protected readonly net = computed<Totals>(() => {
    const { revenue: r, expense: e } = this.totals();
    return {
      planned: this.monthIdx.map((m) => r.planned[m] - e.planned[m]),
      actual: this.monthIdx.map((m) => r.actual[m] - e.actual[m]),
      annual: r.annual - e.annual,
      plannedToDate: r.plannedToDate - e.plannedToDate,
      actualToDate: r.actualToDate - e.actualToDate,
      variance: r.variance + e.variance,
    };
  });

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const ready = !!this.source();
    const { revenue: r, expense: e } = this.totals();
    const n = this.net();
    const achievement = r.plannedToDate ? (r.actualToDate / r.plannedToDate) * 100 : 0;
    return [
      { label: 'الإيرادات المخططة', icon: 'trend-up', value: ready ? r.annual : null, format: formatMoneyCompact, tone: 'var(--gr)', hint: `صافي مخطط ${formatMoneyCompact(n.annual)}` },
      { label: 'المصروفات المخططة', icon: 'trend-down', value: ready ? e.annual : null, format: formatMoneyCompact, tone: 'var(--re)', hint: `${this.draft().filter((l) => l.type === 'expense').length} بند مصروف` },
      {
        label: 'صافي فعلي حتى تاريخه',
        icon: 'scale',
        value: ready ? n.actualToDate : null,
        format: formatMoneyCompact,
        tone: n.variance >= 0 ? 'var(--bl)' : 'var(--am)',
        hint: `المخطط حتى تاريخه ${formatMoneyCompact(n.plannedToDate)}`,
      },
      {
        label: 'نسبة تحقيق الإيرادات',
        icon: 'target',
        value: ready ? achievement : null,
        format: formatPercent,
        tone: achievement >= 100 ? 'var(--gr)' : 'var(--am)',
        hint: this.elapsed() ? `خلال ${this.elapsed()} من 12 شهرًا` : 'لم تبدأ السنة بعد',
      },
    ];
  });

  // ── Chart ──
  protected readonly chartSeries = signal<LineType | 'net'>('revenue');
  protected readonly chartMonths = computed<BudgetChartMonth[]>(() => {
    const series = this.chartSeries();
    const t = series === 'net' ? this.net() : this.totals()[series];
    const elapsed = this.elapsed();
    return this.monthIdx.map((m) => ({ label: MONTH_LABELS[m], planned: t.planned[m], actual: m < elapsed ? t.actual[m] : null }));
  });

  // ── Add line ──
  protected readonly addControl = new FormControl<string | null>(null);
  protected readonly addOptions = computed<SearchableSelectOption[]>(() => {
    const inGrid = new Set(this.draft().map((l) => l.accountId));
    return (this.source()?.lines ?? [])
      .filter((l) => !inGrid.has(l.accountId))
      .map((l) => ({ value: l.accountId, label: `${l.accountCode} — ${l.accountName}`, hint: SECTION_LABEL[l.type] }));
  });

  constructor() {
    // A freshly loaded (or saved) budget replaces the draft.
    effect(() => {
      const b = this.budget.value();
      untracked(() => this.load(b));
    });

    this.addControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      if (!id) return;
      this.addLine(id);
      this.addControl.setValue(null, { emitEvent: false });
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.dirty()) e.preventDefault();
  }

  private load(b: Budget | null): void {
    this.source.set(b);
    if (!b) {
      this.draft.set([]);
      return;
    }
    // Lines with a plan or with postings are shown; the rest can be added.
    this.draft.set(
      b.lines
        .filter((l) => l.planned.some((v) => v !== 0) || l.actual.some((v) => v !== 0))
        .map((l) => ({ ...l, planned: [...l.planned] })),
    );
    this.baseline.set(JSON.stringify(this.payload()));
  }

  // ── Filters ──

  protected async setYear(el: HTMLSelectElement): Promise<void> {
    const value = el.value;
    await this.navigate({ year: Number(value) === this.thisYear ? null : value }, () => (el.value = String(this.year())));
  }

  protected async setCenter(el: HTMLSelectElement): Promise<void> {
    await this.navigate({ costCenterId: el.value || null }, () => (el.value = this.costCenterId() ?? ''));
  }

  private async navigate(queryParams: Record<string, string | null>, revert: () => void): Promise<void> {
    if (this.dirty() && !(await this.confirmDiscard())) {
      revert();
      return;
    }
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private confirmDiscard(): Promise<boolean> {
    return this.dialog.confirm({
      title: 'تعديلات غير محفوظة',
      message: 'لديك تعديلات على الموازنة لم تُحفظ بعد. هل تريد تجاهلها؟',
      confirmText: 'تجاهل التعديلات',
      type: 'warning',
    });
  }

  // ── Editing ──

  private patchLine(accountId: string, fn: (planned: number[], line: BudgetLine) => number[]): void {
    this.draft.update((lines) => lines.map((l) => (l.accountId === accountId ? { ...l, planned: fn([...l.planned], l) } : l)));
  }

  protected setCell(accountId: string, month: number, raw: string): void {
    const value = round2(Number(raw.replace(/,/g, '')) || 0);
    this.patchLine(accountId, (p) => {
      p[month] = value;
      return p;
    });
  }

  /** Editing the annual total spreads it evenly over the 12 months. */
  protected setAnnual(accountId: string, raw: string): void {
    this.patchLine(accountId, () => spreadEvenly(round2(Number(raw.replace(/,/g, '')) || 0)));
  }

  protected fillEvenly(r: RowView): void {
    this.patchLine(r.line.accountId, () => spreadEvenly(r.annual));
  }

  /** Elapsed months take the actual figures; future months keep their plan. */
  protected copyActuals(accountId: string): void {
    const elapsed = this.elapsed();
    this.patchLine(accountId, (p, l) => p.map((v, m) => (m < elapsed ? l.actual[m] : v)));
  }

  protected copyAllActuals(): void {
    const elapsed = this.elapsed();
    if (!elapsed) {
      this.toast.info('لا توجد أشهر منقضية في هذه السنة');
      return;
    }
    this.draft.update((lines) => lines.map((l) => ({ ...l, planned: l.planned.map((v, m) => (m < elapsed ? l.actual[m] : v)) })));
    this.toast.success(`تم نسخ الفعلي لأول ${elapsed} شهر في كل البنود`);
  }

  protected clearLine(accountId: string): void {
    this.patchLine(accountId, () => Array(12).fill(0));
  }

  protected removeLine(r: RowView): void {
    if (r.actualToDate !== 0) {
      // Lines with postings always come back from the server — clear the plan instead.
      this.clearLine(r.line.accountId);
      return;
    }
    this.draft.update((lines) => lines.filter((l) => l.accountId !== r.line.accountId));
  }

  private addLine(accountId: string): void {
    const line = this.source()?.lines.find((l) => l.accountId === accountId);
    if (!line || this.draft().some((l) => l.accountId === accountId)) return;
    this.draft.update((lines) =>
      [...lines, { ...line, planned: [...line.planned] }].sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    );
    this.toast.info(`أُضيف «${line.accountName}» — أدخل المبالغ المخططة ثم احفظ`);
  }

  // ── Save / discard ──

  protected save(): void {
    if (!this.dirty() || this.saving()) return;
    this.saving.set(true);
    this.api
      .save(this.year(), this.payload())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((b) => {
        this.load(b);
        this.toast.success(`تم حفظ موازنة ${this.year()} — ${this.centerName()}`);
      });
  }

  protected async discard(): Promise<void> {
    if (!this.dirty() || !(await this.confirmDiscard())) return;
    this.load(this.source());
  }

  protected export(): void {
    const rows = [...this.rows().revenue, ...this.rows().expense];
    downloadCsv(`budget-${this.year()}`, rows, [
      { label: 'الكود', value: (r) => r.line.accountCode },
      { label: 'الحساب', value: (r) => r.line.accountName },
      { label: 'النوع', value: (r) => SECTION_LABEL[r.line.type] },
      ...this.monthIdx.map((m) => ({ label: MONTH_LABELS[m], value: (r: RowView) => r.line.planned[m] })),
      { label: 'الإجمالي السنوي', value: (r) => r.annual },
      { label: 'المخطط حتى تاريخه', value: (r) => r.plannedToDate },
      { label: 'الفعلي حتى تاريخه', value: (r) => r.actualToDate },
      { label: 'الانحراف', value: (r) => r.variance },
    ]);
  }

  // ── Template helpers ──

  protected varianceText(v: number): string {
    return `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`;
  }

  protected pctText(v: number | null): string {
    return v === null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
  }
}
