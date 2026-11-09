import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { fetchAllPages } from '../../../../core/utils/api-list.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { FilterSelectComponent, toFilterOptions } from '../../../../shared/components/filter-select/filter-select.component';
import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { CountUpDirective } from '../../../../shared/directives/count-up.directive';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { downloadCsv } from '../../../../shared/utils/csv.util';
import { formatDateTime, formatInteger, formatMoney, formatRelative } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { OrderCardComponent } from '../../components/order-card/order-card.component';
import { OrderDetailsDrawerComponent } from '../../components/order-details-drawer/order-details-drawer.component';
import { OrderStatusTabsComponent } from '../../components/order-status-tabs/order-status-tabs.component';
import {
  CHANNEL_LABEL,
  ORDER_CHANNELS,
  ORDER_ITEMS_PLURAL,
  ORDER_PERIODS,
  ORDER_STATUS_VIEW,
  OrderStats,
  OrderStatus,
  OrderSummary,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_VIEW,
} from '../../models/order.model';
import { OrdersService } from '../../services/orders.service';

interface SummaryTile {
  label: string;
  icon: IconName;
  value: (s: OrderStats) => number;
  format: (v: number) => string;
  tone?: string;
}

const SUMMARY_TILES: readonly SummaryTile[] = [
  { label: 'عدد الطلبات', icon: 'cart', value: (s) => s.count, format: formatInteger },
  { label: 'إجمالي المبيعات', icon: 'wallet', value: (s) => s.revenue, format: formatMoney },
  { label: 'متوسط قيمة الطلب', icon: 'receipt', value: (s) => s.avgValue, format: formatMoney },
  { label: 'بانتظار التجهيز', icon: 'clock', value: (s) => s.byStatus.pending + s.byStatus.processing, format: formatInteger, tone: 'var(--am)' },
];

const ORDER_FILTERS = ['status', 'channel', 'payment', 'period'] as const;

/** Orders: status tabs, search, filters, sort, paging, table/cards, details drawer — all in the URL. */
@Component({
  selector: 'app-orders-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    CountUpDirective,
    DataTableComponent,
    FilterSelectComponent,
    IconComponent,
    ListToolbarComponent,
    OrderCardComponent,
    OrderDetailsDrawerComponent,
    OrderStatusTabsComponent,
    PageHeaderComponent,
    PaginationComponent,
    RowTemplateDirective,
    StatusPillComponent,
  ],
  templateUrl: './orders.page.html',
  styleUrl: './orders.page.scss',
})
export class OrdersPage {
  private readonly orders = inject(OrdersService);
  private readonly toast = inject(ToastService);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'createdAt', dir: 'desc' },
    filters: ORDER_FILTERS,
  });
  protected readonly list = createListResource(this.state.query, (q) => this.orders.list(q));

  /** Same search + filters minus status, so every tab keeps its own count. */
  private readonly statsFilters = computed(
    () => {
      const { status: _status, ...filters } = this.state.query().filters;
      return { ...filters, search: this.state.query().search };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly stats = createQueryResource(this.statsFilters, (f) => this.orders.stats(f));

  /** Open drawer, mirrored to `?order=` so a refresh or shared link reopens it. */
  protected readonly openOrderId = this.state.param('order');
  protected readonly activeStatus = computed(() => (this.state.query().filters['status'] as OrderStatus) ?? null);
  protected readonly exporting = signal(false);

  protected readonly tiles = SUMMARY_TILES;
  protected readonly channelOptions = toFilterOptions(ORDER_CHANNELS, (c) => CHANNEL_LABEL[c]);
  protected readonly paymentOptions = toFilterOptions(PAYMENT_STATUSES, (p) => PAYMENT_STATUS_VIEW[p].label);
  protected readonly periodOptions = ORDER_PERIODS;

  protected readonly sortOptions: SortOption[] = [
    { key: 'createdAt', label: 'التاريخ' },
    { key: 'total', label: 'الإجمالي' },
    { key: 'customerName', label: 'العميل' },
    { key: 'itemCount', label: 'الكمية' },
  ];

  private readonly numberCell = viewChild.required<TemplateRef<{ $implicit: OrderSummary }>>('numberCell');
  private readonly customerCell = viewChild.required<TemplateRef<{ $implicit: OrderSummary }>>('customerCell');
  private readonly channelCell = viewChild.required<TemplateRef<{ $implicit: OrderSummary }>>('channelCell');
  private readonly totalCell = viewChild.required<TemplateRef<{ $implicit: OrderSummary }>>('totalCell');
  private readonly paymentCell = viewChild.required<TemplateRef<{ $implicit: OrderSummary }>>('paymentCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: OrderSummary }>>('statusCell');

  protected readonly columns = computed<TableColumn<OrderSummary>[]>(() => [
    { key: 'createdAt', label: 'الطلب', sortable: true, width: '150px', cellTemplate: this.numberCell() },
    { key: 'customerName', label: 'العميل', sortable: true, cellTemplate: this.customerCell() },
    { key: 'channel', label: 'القناة', cellTemplate: this.channelCell() },
    { key: 'total', label: 'الإجمالي', sortable: true, align: 'end', cellTemplate: this.totalCell() },
    { key: 'paymentStatus', label: 'الدفع', align: 'center', cellTemplate: this.paymentCell() },
    { key: 'status', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
  ]);

  protected readonly statusView = ORDER_STATUS_VIEW;
  protected readonly paymentView = PAYMENT_STATUS_VIEW;
  protected readonly channel = CHANNEL_LABEL;
  protected readonly method = PAYMENT_METHOD_LABEL;
  protected readonly money = formatMoney;
  protected readonly relative = formatRelative;
  protected readonly items = (n: number) => pluralAr(n, ORDER_ITEMS_PLURAL);

  protected open(order: OrderSummary): void {
    this.state.setParam('order', order.id);
  }

  protected closeDrawer(): void {
    this.state.setParam('order', null);
  }

  protected setStatus(status: OrderStatus | null): void {
    this.state.setFilter('status', status);
  }

  protected refresh(): void {
    this.list.reload();
    this.stats.reload();
  }

  /** Exports every order matching the current search/filters, not just this page. */
  protected export(): void {
    const query = this.state.query();
    this.exporting.set(true);
    fetchAllPages((pageIndex, pageSize) => this.orders.list({ ...query, pageIndex, pageSize }), 100)
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((rows) => {
        downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}`, rows, [
          { label: 'رقم الطلب', value: (o) => o.number },
          { label: 'التاريخ', value: (o) => formatDateTime(o.createdAt) },
          { label: 'العميل', value: (o) => o.customerName },
          { label: 'الهاتف', value: (o) => o.customerPhone },
          { label: 'المدينة', value: (o) => o.city },
          { label: 'القناة', value: (o) => CHANNEL_LABEL[o.channel] },
          { label: 'الكمية', value: (o) => o.itemCount },
          { label: 'الإجمالي', value: (o) => o.total },
          { label: 'طريقة الدفع', value: (o) => PAYMENT_METHOD_LABEL[o.paymentMethod] },
          { label: 'حالة الدفع', value: (o) => PAYMENT_STATUS_VIEW[o.paymentStatus].label },
          { label: 'الحالة', value: (o) => ORDER_STATUS_VIEW[o.status].label },
        ]);
        this.toast.success(`تم تصدير ${formatInteger(rows.length)} طلب`);
      });
  }
}
