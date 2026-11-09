import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ListQuery } from '../../../../core/models/list-query.model';
import { ToastService } from '../../../../core/services/toast.service';
import { fetchAllPages } from '../../../../core/utils/api-list.util';
import { AreaChartComponent, ChartPoint } from '../../../../shared/components/charts/area-chart/area-chart.component';
import { BarListComponent, BarListRow } from '../../../../shared/components/charts/bar-list/bar-list.component';
import { DonutChartComponent, DonutSegment } from '../../../../shared/components/charts/donut-chart/donut-chart.component';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { DeltaComponent } from '../../../../shared/components/delta/delta.component';
import { FilterSelectComponent, FilterOption } from '../../../../shared/components/filter-select/filter-select.component';
import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { CountUpDirective } from '../../../../shared/directives/count-up.directive';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { downloadCsv } from '../../../../shared/utils/csv.util';
import {
  formatDayMonth,
  formatInteger,
  formatMoney,
  formatMoneyCompact,
  formatMonth,
  formatPercent,
} from '../../../../shared/utils/format.util';
import { ItemGroupsService } from '../../../items/services/item-groups.service';
import { CHANNEL_LABEL, ORDER_STATUS_VIEW, PAYMENT_METHOD_LABEL } from '../../../orders/models/order.model';
import {
  DEFAULT_REPORT_RANGE,
  isReportRange,
  ProductReportRow,
  ReportKpis,
  REPORT_RANGES,
  ReportRange,
} from '../../models/report.model';
import { ReportsService } from '../../services/reports.service';

type TrendMetric = 'revenue' | 'orders';

interface KpiConfig {
  key: keyof ReportKpis;
  label: string;
  icon: IconName;
  format: (v: number) => string;
}

const KPIS: readonly KpiConfig[] = [
  { key: 'revenue', label: 'صافي المبيعات', icon: 'wallet', format: formatMoneyCompact },
  { key: 'orders', label: 'الطلبات المنفذة', icon: 'cart', format: formatInteger },
  { key: 'avgOrderValue', label: 'متوسط قيمة الطلب', icon: 'receipt', format: formatMoney },
  { key: 'grossProfit', label: 'إجمالي الربح', icon: 'trend-up', format: formatMoneyCompact },
];

/** Payment methods get fixed chart colours so the same method looks the same everywhere. */
const PAYMENT_COLORS = { cash: 'var(--gr)', card: 'var(--bl)', wallet: 'var(--pu)', credit: 'var(--am)' } as const;

/** Sales reports: range in the URL, KPIs, trend, breakdowns and a product performance table. */
@Component({
  selector: 'app-reports-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AreaChartComponent,
    BarListComponent,
    CountUpDirective,
    DataTableComponent,
    DeltaComponent,
    DonutChartComponent,
    FilterSelectComponent,
    IconComponent,
    KpiCardComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    RowTemplateDirective,
  ],
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
})
export class ReportsPage {
  private readonly reports = inject(ReportsService);
  private readonly toast = inject(ToastService);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 10,
    defaultSort: { key: 'revenue', dir: 'desc' },
    filters: ['groupId'],
  });

  // ── Range & chart metric (URL) ──
  private readonly rangeParam = this.state.param('range', DEFAULT_REPORT_RANGE);
  protected readonly range = computed<ReportRange>(() => {
    const r = this.rangeParam();
    return isReportRange(r) ? r : DEFAULT_REPORT_RANGE;
  });
  private readonly metricParam = this.state.param('metric');
  protected readonly metric = computed<TrendMetric>(() => (this.metricParam() === 'orders' ? 'orders' : 'revenue'));
  protected readonly ranges = REPORT_RANGES;
  protected readonly period = computed(() => REPORT_RANGES.find((r) => r.value === this.range())!.period);

  // ── Data ──
  protected readonly overview = createQueryResource(this.range, (r) => this.reports.overview(r), {
    errorMessage: 'تعذّر تحميل التقارير',
  });

  /** Range rides along in the filters so changing it always refetches the table. */
  private readonly productsQuery = computed<ListQuery>(
    () => ({ ...this.state.query(), filters: { ...this.state.query().filters, range: this.range() } }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly products = createListResource(this.productsQuery, (q) => this.reports.products(q));
  protected readonly exporting = signal(false);

  private readonly groups = toSignal(inject(ItemGroupsService).lookup(), { initialValue: [] });
  protected readonly groupOptions = computed<FilterOption[]>(() => this.groups().map((g) => ({ value: g.id, label: g.name })));

  // ── View models ──
  protected readonly kpis = KPIS;

  protected readonly trend = computed(() => {
    const o = this.overview.value();
    if (!o) return null;
    const label = o.granularity === 'month' ? formatMonth : formatDayMonth;
    const revenue = this.metric() === 'revenue';
    const points: ChartPoint[] = o.series.map((p) => ({ label: label(p.date), value: revenue ? p.revenue : p.orders }));
    const kpi = revenue ? o.kpis.revenue : o.kpis.orders;
    return {
      points,
      total: kpi.value,
      deltaPct: kpi.deltaPct,
      name: revenue ? 'المبيعات' : 'الطلبات',
      format: revenue ? formatMoney : formatInteger,
      tick: revenue ? formatMoneyCompact : formatInteger,
    };
  });

  protected readonly statusSegments = computed<DonutSegment[]>(() =>
    (this.overview.value()?.statuses ?? []).map((s) => ({
      key: s.status,
      label: ORDER_STATUS_VIEW[s.status].label,
      value: s.orders,
      color: ORDER_STATUS_VIEW[s.status].color,
    })),
  );

  protected readonly paymentSegments = computed<DonutSegment[]>(() =>
    (this.overview.value()?.payments ?? []).map((p) => ({
      key: p.method,
      label: PAYMENT_METHOD_LABEL[p.method],
      value: p.amount,
      color: PAYMENT_COLORS[p.method],
    })),
  );

  protected readonly categoryRows = computed<BarListRow[]>(() =>
    (this.overview.value()?.categories ?? []).map((c) => ({
      key: c.groupId,
      label: c.name,
      sub: `${formatInteger(c.units)} قطعة`,
      value: c.revenue,
      display: formatMoneyCompact(c.revenue),
    })),
  );

  protected readonly channelRows = computed<BarListRow[]>(() =>
    (this.overview.value()?.channels ?? []).map((c) => ({
      key: c.channel,
      label: CHANNEL_LABEL[c.channel],
      sub: `${formatInteger(c.orders)} طلب`,
      value: c.revenue,
      display: formatMoneyCompact(c.revenue),
    })),
  );

  // ── Products table ──
  protected readonly sortOptions: SortOption[] = [
    { key: 'revenue', label: 'المبيعات' },
    { key: 'unitsSold', label: 'الكمية المباعة' },
    { key: 'profit', label: 'الربح' },
    { key: 'marginPct', label: 'هامش الربح' },
    { key: 'name', label: 'الاسم' },
  ];

  private readonly productCell = viewChild.required<TemplateRef<{ $implicit: ProductReportRow }>>('productCell');
  private readonly unitsCell = viewChild.required<TemplateRef<{ $implicit: ProductReportRow }>>('unitsCell');
  private readonly revenueCell = viewChild.required<TemplateRef<{ $implicit: ProductReportRow }>>('revenueCell');
  private readonly profitCell = viewChild.required<TemplateRef<{ $implicit: ProductReportRow }>>('profitCell');
  private readonly shareCell = viewChild.required<TemplateRef<{ $implicit: ProductReportRow }>>('shareCell');

  protected readonly columns = computed<TableColumn<ProductReportRow>[]>(() => [
    { key: 'name', label: 'الصنف', sortable: true, cellTemplate: this.productCell() },
    { key: 'unitsSold', label: 'الكمية', sortable: true, align: 'center', cellTemplate: this.unitsCell() },
    { key: 'revenue', label: 'المبيعات', sortable: true, align: 'end', cellTemplate: this.revenueCell() },
    { key: 'profit', label: 'الربح', sortable: true, align: 'end', cellTemplate: this.profitCell() },
    { key: 'sharePct', label: 'الحصة', sortable: true, width: '160px', cellTemplate: this.shareCell() },
  ]);

  /** Share bars scale to the largest share on the page, whatever the sort. */
  protected readonly maxShare = computed(() => Math.max(0.01, ...this.products.items().map((p) => p.sharePct)));

  protected readonly money = formatMoney;
  protected readonly integer = formatInteger;
  protected readonly percent = formatPercent;
  protected readonly moneyCompact = formatMoneyCompact;

  protected setRange(range: ReportRange): void {
    this.state.setParam('range', range === DEFAULT_REPORT_RANGE ? null : range, true);
  }

  protected setMetric(metric: TrendMetric): void {
    this.state.setParam('metric', metric === 'revenue' ? null : metric);
  }

  protected refresh(): void {
    this.overview.reload();
    this.products.reload();
  }

  /** Exports every product row for the current range / search / group. */
  protected export(): void {
    const query = this.productsQuery();
    this.exporting.set(true);
    fetchAllPages((pageIndex, pageSize) => this.reports.products({ ...query, pageIndex, pageSize }), 100)
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((rows) => {
        downloadCsv(`products-report-${this.range()}`, rows, [
          { label: 'الكود', value: (r) => r.code },
          { label: 'الصنف', value: (r) => r.name },
          { label: 'المجموعة', value: (r) => r.groupName },
          { label: 'الكمية المباعة', value: (r) => r.unitsSold },
          { label: 'عدد الطلبات', value: (r) => r.orders },
          { label: 'المبيعات', value: (r) => r.revenue },
          { label: 'الربح', value: (r) => r.profit },
          { label: 'هامش الربح %', value: (r) => r.marginPct },
          { label: 'الحصة %', value: (r) => r.sharePct },
        ]);
        this.toast.success(`تم تصدير ${formatInteger(rows.length)} صنف`);
      });
  }
}
