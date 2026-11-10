import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { fetchAllPages } from '../../../../core/utils/api-list.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { DateRange, DateRangeComponent } from '../../../../shared/components/date-range/date-range.component';
import { FilterOption, FilterSelectComponent, toFilterOptions } from '../../../../shared/components/filter-select/filter-select.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { StatusTab, StatusTabsComponent } from '../../../../shared/components/status-tabs/status-tabs.component';
import { SummaryTile, SummaryTilesComponent } from '../../../../shared/components/summary-tiles/summary-tiles.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { todayIsoDate } from '../../../../shared/utils/date-iso.util';
import { downloadCsv } from '../../../../shared/utils/csv.util';
import { formatDateTime, formatDayMonth, formatInteger, formatMoney, formatMoneyCompact, formatRelative } from '../../../../shared/utils/format.util';
import { PaymentDrawerComponent } from '../../components/payment-drawer/payment-drawer.component';
import {
  isSettlementOverdue,
  PaymentSummary,
  SETTLEMENT_FILTERS,
  SETTLEMENT_VIEW,
  STORE_PAYMENT_METHOD_VIEW,
  STORE_PAYMENT_METHODS,
  STORE_PAYMENT_STATUS_VIEW,
  STORE_PAYMENT_STATUSES,
} from '../../models/payment.model';
import { PaymentsService } from '../../services/payments.service';

const FILTERS = ['status', 'method', 'settlement', 'from', 'to', 'orderId'] as const;

/**
 * Online-store payments: gateway / wallet / COD collections, their fees,
 * refunds and settlement. List state + `?view=<id>` drawer live in the URL.
 */
@Component({
  selector: 'app-payments-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    DataTableComponent,
    DateRangeComponent,
    FilterSelectComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    PaymentDrawerComponent,
    RowTemplateDirective,
    StatusPillComponent,
    StatusTabsComponent,
    SummaryTilesComponent,
  ],
  templateUrl: './payments.page.html',
  styleUrl: './payments.page.scss',
})
export class PaymentsPage {
  private readonly payments = inject(PaymentsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'createdAt', dir: 'desc' },
    filters: FILTERS,
  });
  protected readonly list = createListResource(this.state.query, (q) => this.payments.list(q));

  /** Stats ignore paging / sort (and the server ignores status), so tabs keep their counts. */
  private readonly statsQuery = computed(() => ({ ...this.state.query(), pageIndex: 1, sort: null }), {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  protected readonly stats = createQueryResource(this.statsQuery, (q) => this.payments.stats(q));

  protected readonly viewing = this.state.param('view');
  protected readonly exporting = signal(false);

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const s = this.stats.value();
    return [
      {
        label: 'إجمالي المحصّل',
        icon: 'cash-in',
        value: s?.collected ?? null,
        format: formatMoneyCompact,
        tone: 'var(--gr)',
        hint: s ? `الصافي ${formatMoneyCompact(s.net)}` : undefined,
      },
      {
        label: 'قيد التحصيل',
        icon: 'clock',
        value: s?.pending ?? null,
        format: formatMoneyCompact,
        tone: 'var(--am)',
        hint: s ? `${formatInteger(s.pendingCount)} عملية معلّقة` : undefined,
      },
      { label: 'رسوم البوابات والشحن', icon: 'file-percent', value: s?.fees ?? null, format: formatMoneyCompact, tone: 'var(--pu)' },
      { label: 'المبالغ المستردة', icon: 'return', value: s?.refunds ?? null, format: formatMoneyCompact, tone: 'var(--re)' },
      {
        label: 'بانتظار التسوية',
        icon: 'scale',
        value: s?.unsettled ?? null,
        format: formatMoneyCompact,
        tone: 'var(--bl)',
        hint: s ? `${formatInteger(s.unsettledCount)} عملية${s.overdueCount ? ` · ${formatInteger(s.overdueCount)} متأخرة` : ''}` : undefined,
      },
    ];
  });

  protected readonly tabs = computed<StatusTab[]>(() => {
    const s = this.stats.value();
    return [
      { value: null, label: 'الكل', color: 'var(--primary)', count: s?.count ?? null },
      ...STORE_PAYMENT_STATUSES.map((status) => ({
        value: status,
        label: STORE_PAYMENT_STATUS_VIEW[status].label,
        color: STORE_PAYMENT_STATUS_VIEW[status].color,
        count: s ? s.byStatus[status] : null,
      })),
    ];
  });

  protected readonly methodOptions = toFilterOptions(STORE_PAYMENT_METHODS, (m) => STORE_PAYMENT_METHOD_VIEW[m].label);
  protected readonly settlementOptions: FilterOption[] = SETTLEMENT_FILTERS.map((f) => ({ value: f.value, label: f.label }));

  protected readonly sortOptions: SortOption[] = [
    { key: 'createdAt', label: 'الأحدث' },
    { key: 'amount', label: 'المبلغ' },
    { key: 'net', label: 'الصافي' },
    { key: 'customerName', label: 'العميل' },
    { key: 'orderNumber', label: 'رقم الطلب' },
  ];

  // ── Table ──

  private readonly numberCell = viewChild.required<TemplateRef<{ $implicit: PaymentSummary }>>('numberCell');
  private readonly customerCell = viewChild.required<TemplateRef<{ $implicit: PaymentSummary }>>('customerCell');
  private readonly methodCell = viewChild.required<TemplateRef<{ $implicit: PaymentSummary }>>('methodCell');
  private readonly amountCell = viewChild.required<TemplateRef<{ $implicit: PaymentSummary }>>('amountCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: PaymentSummary }>>('statusCell');
  private readonly settlementCell = viewChild.required<TemplateRef<{ $implicit: PaymentSummary }>>('settlementCell');

  protected readonly columns = computed<TableColumn<PaymentSummary>[]>(() => [
    { key: 'createdAt', label: 'العملية', sortable: true, width: '150px', cellTemplate: this.numberCell() },
    { key: 'customerName', label: 'العميل / الطلب', sortable: true, cellTemplate: this.customerCell() },
    { key: 'method', label: 'طريقة الدفع', cellTemplate: this.methodCell() },
    { key: 'amount', label: 'المبلغ', sortable: true, align: 'end', cellTemplate: this.amountCell() },
    { key: 'status', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
    { key: 'settlementStatus', label: 'التسوية', align: 'center', cellTemplate: this.settlementCell() },
  ]);

  protected readonly statusView = STORE_PAYMENT_STATUS_VIEW;
  protected readonly methodView = STORE_PAYMENT_METHOD_VIEW;
  protected readonly settlementView = SETTLEMENT_VIEW;
  protected readonly money = formatMoney;
  protected readonly relative = formatRelative;
  protected readonly day = (iso: string) => formatDayMonth(iso.slice(0, 10));
  protected readonly overdue = (p: PaymentSummary) => isSettlementOverdue(p, todayIsoDate());

  protected open(p: PaymentSummary): void {
    this.state.setParam('view', p.id);
  }

  protected setRange(range: DateRange): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: range.from, to: range.to, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected refresh(): void {
    this.list.reload();
    this.stats.reload();
  }

  /** Exports every payment matching the current search / filters, not just this page. */
  protected export(): void {
    const query = this.state.query();
    this.exporting.set(true);
    fetchAllPages((pageIndex, pageSize) => this.payments.list({ ...query, pageIndex, pageSize }), 100)
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((rows) => {
        downloadCsv(`payments-${todayIsoDate()}`, rows, [
          { label: 'رقم العملية', value: (p) => p.number },
          { label: 'التاريخ', value: (p) => formatDateTime(p.createdAt) },
          { label: 'رقم الطلب', value: (p) => p.orderNumber },
          { label: 'العميل', value: (p) => p.customerName },
          { label: 'الهاتف', value: (p) => p.customerPhone },
          { label: 'طريقة الدفع', value: (p) => STORE_PAYMENT_METHOD_VIEW[p.method].label },
          { label: 'مزود الخدمة', value: (p) => p.provider },
          { label: 'المرجع', value: (p) => p.reference },
          { label: 'المبلغ', value: (p) => p.amount },
          { label: 'الرسوم', value: (p) => p.fee },
          { label: 'المسترد', value: (p) => p.refunded },
          { label: 'الصافي', value: (p) => p.net },
          { label: 'الحالة', value: (p) => STORE_PAYMENT_STATUS_VIEW[p.status].label },
          { label: 'سبب الفشل', value: (p) => p.failureReason ?? '' },
          { label: 'التسوية', value: (p) => (p.settlementStatus ? SETTLEMENT_VIEW[p.settlementStatus].label : '') },
          { label: 'موعد التسوية', value: (p) => p.expectedSettlementDate ?? '' },
          { label: 'دفعة التسوية', value: (p) => p.settlementBatch ?? '' },
        ]);
        this.toast.success(`تم تصدير ${formatInteger(rows.length)} عملية دفع`);
      });
  }
}
