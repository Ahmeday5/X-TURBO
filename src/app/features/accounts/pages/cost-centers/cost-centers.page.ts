import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { finalize } from 'rxjs';
import { ListQuery } from '../../../../core/models/list-query.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { fetchAllPages } from '../../../../core/utils/api-list.util';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatusTab, StatusTabsComponent } from '../../../../shared/components/status-tabs/status-tabs.component';
import { SummaryTile, SummaryTilesComponent } from '../../../../shared/components/summary-tiles/summary-tiles.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { downloadCsv } from '../../../../shared/utils/csv.util';
import { formatInteger, formatMoney, formatMoneyCompact, formatPercent } from '../../../../shared/utils/format.util';
import { CostCenter } from '../../models/cost-center.model';
import { CostCentersService } from '../../services/cost-centers.service';
import { CostCenterEditorComponent } from './cost-center-editor/cost-center-editor.component';
import { todayIsoDate } from '../../../../shared/utils/date-iso.util';
import { DetailsDrawerComponent } from '../../../../shared/components/details-drawer/details-drawer.component';
import { toCostCenterDetails } from '../../utils/accounts-details';

export interface BudgetUsage {
  /** % of the annual budget spent, `null` when there is no budget. */
  pct: number | null;
  /** Bar width, capped at 100. */
  width: number;
  tone: 'good' | 'warning' | 'danger' | 'none';
  over: boolean;
  remaining: number;
}

export function budgetUsage(c: Pick<CostCenter, 'annualBudget' | 'actualSpend'>): BudgetUsage {
  if (!c.annualBudget) return { pct: null, width: 0, tone: 'none', over: false, remaining: 0 };
  const pct = (c.actualSpend / c.annualBudget) * 100;
  const tone = pct > 100 ? 'danger' : pct >= 85 ? 'warning' : 'good';
  return { pct, width: Math.max(0, Math.min(100, pct)), tone, over: pct > 100, remaining: c.annualBudget - c.actualSpend };
}

/** Cost centers — budget vs actual spend, revenue, postings; editor in a drawer. */
@Component({
  selector: 'app-cost-centers-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DetailsDrawerComponent,
    CostCenterEditorComponent,
    DataTableComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    RowTemplateDirective,
    StatusTabsComponent,
    SummaryTilesComponent,
  ],
  templateUrl: './cost-centers.page.html',
  styleUrl: './cost-centers.page.scss',
})
export class CostCentersPage {
  private readonly api = inject(CostCentersService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  // ── Details drawer (👁) — fetched by id, so it shows the server's current state ──
  protected readonly viewId = signal<string | null>(null);
  protected readonly viewed = createQueryResource(this.viewId, (id) => this.api.get(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل التفاصيل',
  });
  protected readonly details = computed(() => {
    const x = this.viewed.value();
    return x && x.id === this.viewId() ? toCostCenterDetails(x) : null;
  });

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'code', dir: 'asc' },
    filters: ['status'],
    defaultView: 'cards',
  });
  protected readonly list = createListResource(this.state.query, (q) => this.api.list(q));

  /** Every center (totals, tab counts, parent picker) — the set is small. */
  private readonly allQuery = signal<ListQuery>({ pageIndex: 1, pageSize: 100, search: '', sort: { key: 'code', dir: 'asc' }, filters: {} });
  protected readonly all = createQueryResource(this.allQuery, (q) =>
    fetchAllPages((pageIndex, pageSize) => this.api.list({ ...q, pageIndex, pageSize }), 100),
  );
  protected readonly centers = computed(() => this.all.value() ?? []);

  protected readonly totals = computed(() => {
    const rows = this.centers();
    const budgeted = rows.filter((c) => c.annualBudget > 0);
    const budget = budgeted.reduce((s, c) => s + c.annualBudget, 0);
    const spendOnBudgeted = budgeted.reduce((s, c) => s + c.actualSpend, 0);
    return {
      count: rows.length,
      active: rows.filter((c) => c.isActive).length,
      budget,
      spend: rows.reduce((s, c) => s + c.actualSpend, 0),
      revenue: rows.reduce((s, c) => s + c.actualRevenue, 0),
      usagePct: budget ? (spendOnBudgeted / budget) * 100 : null,
      over: rows.filter((c) => budgetUsage(c).over).length,
    };
  });

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const ready = !!this.all.value();
    const t = this.totals();
    return [
      { label: 'مراكز التكلفة', icon: 'target', value: ready ? t.count : null, format: formatInteger, hint: ready ? `${formatInteger(t.active)} نشط` : undefined },
      { label: 'إجمالي الموازنات السنوية', icon: 'wallet', value: ready ? t.budget : null, format: formatMoneyCompact, tone: 'var(--bl)' },
      {
        label: 'المصروف الفعلي هذا العام',
        icon: 'cash-out',
        value: ready ? t.spend : null,
        format: formatMoneyCompact,
        tone: 'var(--am)',
        hint: ready && t.usagePct !== null ? `${formatPercent(t.usagePct)} من الموازنات` : undefined,
      },
      {
        label: 'تجاوزت الموازنة',
        icon: 'alert',
        value: ready ? t.over : null,
        format: formatInteger,
        tone: 'var(--re)',
        hint: ready ? `إيرادات ${formatMoneyCompact(t.revenue)}` : undefined,
      },
    ];
  });

  protected readonly tabs = computed<StatusTab[]>(() => {
    const ready = !!this.all.value();
    const t = this.totals();
    return [
      { value: null, label: 'الكل', color: 'var(--primary)', count: ready ? t.count : null },
      { value: 'active', label: 'نشطة', color: 'var(--gr)', count: ready ? t.active : null },
      { value: 'inactive', label: 'موقوفة', color: 'var(--txt3)', count: ready ? t.count - t.active : null },
    ];
  });

  protected readonly sortOptions: SortOption[] = [
    { key: 'code', label: 'الكود' },
    { key: 'name', label: 'الاسم' },
    { key: 'annualBudget', label: 'الموازنة' },
    { key: 'actualSpend', label: 'المصروف الفعلي' },
    { key: 'actualRevenue', label: 'الإيرادات' },
    { key: 'postingsCount', label: 'عدد القيود' },
  ];

  private readonly codeCell = viewChild.required<TemplateRef<{ $implicit: CostCenter }>>('codeCell');
  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: CostCenter }>>('nameCell');
  private readonly parentCell = viewChild.required<TemplateRef<{ $implicit: CostCenter }>>('parentCell');
  private readonly budgetCell = viewChild.required<TemplateRef<{ $implicit: CostCenter }>>('budgetCell');
  private readonly revenueCell = viewChild.required<TemplateRef<{ $implicit: CostCenter }>>('revenueCell');
  private readonly postingsCell = viewChild.required<TemplateRef<{ $implicit: CostCenter }>>('postingsCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: CostCenter }>>('statusCell');

  protected readonly columns = computed<TableColumn<CostCenter>[]>(() => [
    { key: 'code', label: 'الكود', sortable: true, width: '90px', cellTemplate: this.codeCell() },
    { key: 'name', label: 'المركز', sortable: true, cellTemplate: this.nameCell() },
    { key: 'parentName', label: 'المركز الرئيسي', cellTemplate: this.parentCell() },
    { key: 'actualSpend', label: 'الموازنة مقابل الفعلي', sortable: true, width: '260px', cellTemplate: this.budgetCell() },
    { key: 'actualRevenue', label: 'الإيرادات', sortable: true, align: 'end', cellTemplate: this.revenueCell() },
    { key: 'postingsCount', label: 'القيود', sortable: true, align: 'center', cellTemplate: this.postingsCell() },
    { key: 'isActive', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
  ]);

  protected readonly usage = budgetUsage;
  protected readonly money = formatMoney;
  protected readonly moneyCompact = formatMoneyCompact;
  protected readonly pct = formatPercent;
  protected readonly int = formatInteger;
  protected readonly exporting = signal(false);

  /** Drawer state: `'new'`, the center being edited, or closed. */
  protected readonly editing = signal<CostCenter | 'new' | null>(null);
  protected readonly editingCenter = computed(() => {
    const c = this.editing();
    return c && c !== 'new' ? c : null;
  });

  protected create(): void {
    this.editing.set('new');
  }

  protected edit(c: CostCenter): void {
    this.editing.set(c);
  }

  protected onSaved(): void {
    this.editing.set(null);
    this.refresh();
  }

  protected refresh(): void {
    this.list.reload();
    this.all.reload();
  }

  protected async remove(c: CostCenter): Promise<void> {
    if (c.postingsCount > 0) {
      this.toast.warning(`«${c.name}» عليه ${formatInteger(c.postingsCount)} قيد — لا يمكن حذفه، أوقفه بدلًا من ذلك`);
      return;
    }
    const confirmed = await this.dialog.confirm({
      title: 'حذف مركز التكلفة',
      message: `سيتم حذف «${c.name}» (${c.code}) نهائيًا. المراكز التي لها مراكز فرعية أو موظفون تابعون لا تُحذف. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete(c.id).subscribe(() => {
      this.toast.success('تم حذف مركز التكلفة');
      this.refresh();
    });
  }

  protected export(): void {
    const query = this.state.query();
    this.exporting.set(true);
    fetchAllPages((pageIndex, pageSize) => this.api.list({ ...query, pageIndex, pageSize }), 100)
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((rows) => {
        downloadCsv(`cost-centers-${todayIsoDate()}`, rows, [
          { label: 'الكود', value: (c) => c.code },
          { label: 'الاسم', value: (c) => c.name },
          { label: 'المركز الرئيسي', value: (c) => c.parentName ?? '' },
          { label: 'المسؤول', value: (c) => c.manager },
          { label: 'الموازنة السنوية', value: (c) => c.annualBudget },
          { label: 'المصروف الفعلي', value: (c) => c.actualSpend },
          { label: 'نسبة الاستهلاك %', value: (c) => { const p = budgetUsage(c).pct; return p === null ? '' : Math.round(p * 10) / 10; } },
          { label: 'الإيرادات', value: (c) => c.actualRevenue },
          { label: 'عدد القيود', value: (c) => c.postingsCount },
          { label: 'الحالة', value: (c) => (c.isActive ? 'نشط' : 'موقوف') },
          { label: 'ملاحظات', value: (c) => c.notes },
        ]);
        this.toast.success(`تم تصدير ${formatInteger(rows.length)} مركز تكلفة`);
      });
  }
}
