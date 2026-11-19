import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ListQuery } from '../../../../core/models/list-query.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { FilterOption, FilterSelectComponent } from '../../../../shared/components/filter-select/filter-select.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { RowMenuComponent } from '../../../../shared/components/row-menu/row-menu.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { StatusTab, StatusTabsComponent } from '../../../../shared/components/status-tabs/status-tabs.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { RowAction } from '../../../../shared/models/row-action.model';
import { createListResource } from '../../../../shared/list/list-resource';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { formatDateTime, formatRelative } from '../../../../shared/utils/format.util';
import { telHref, toLocalMobile } from '../../../../shared/utils/phone.util';
import { canAssignDriver, canCancelOrder, ORDER_STATUS_VIEW } from '../../../orders/models/order.model';
import { OrdersService } from '../../../orders/services/orders.service';
import { AssignDriverModalComponent, AssignTarget } from '../../components/assign-driver-modal/assign-driver-modal.component';
import { ResolveProblemModalComponent, ResolveTarget } from '../../components/resolve-problem-modal/resolve-problem-modal.component';
import { isProblemOpen, ORDER_PROBLEM_STATUS_VIEW, OrderProblem, problemStatus } from '../../models/order-problem.model';
import { DeliveryStatsService } from '../../services/delivery-stats.service';
import { DriversService } from '../../services/drivers.service';
import { OrderProblemsService } from '../../services/order-problems.service';

type ProblemAction = 'resolve' | 'reassign' | 'cancel' | 'order';

/** `?status=` value for "every problem" — absent means the default "open" tab. */
const ALL = 'all';

function problemActions(p: OrderProblem): RowAction<ProblemAction>[] {
  const actions: RowAction<ProblemAction>[] = [];
  if (isProblemOpen(p)) {
    actions.push({ key: 'resolve', label: 'الرد على المندوب', icon: 'check', tone: 'primary' });
    if (canAssignDriver(p.orderStatus)) actions.push({ key: 'reassign', label: 'تحويل لمندوب آخر', icon: 'swap' });
  }
  actions.push({ key: 'order', label: 'تفاصيل الطلب', icon: 'eye' });
  if (isProblemOpen(p) && canCancelOrder(p.orderStatus)) {
    actions.push({ key: 'cancel', label: 'إلغاء الطلب', icon: 'x', tone: 'danger', separated: true });
  }
  return actions;
}

/**
 * Delivery problems reported from the driver app: open / answered tabs,
 * search, a driver filter, and the three ways to close one — reply, move the
 * order to another driver, or cancel the order.
 */
@Component({
  selector: 'app-order-problems-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AssignDriverModalComponent,
    AvatarComponent,
    DataTableComponent,
    FilterSelectComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    ResolveProblemModalComponent,
    RowMenuComponent,
    RowTemplateDirective,
    StatusPillComponent,
    StatusTabsComponent,
  ],
  templateUrl: './order-problems.page.html',
  styleUrl: './order-problems.page.scss',
})
export class OrderProblemsPage {
  private readonly problems = inject(OrderProblemsService);
  private readonly drivers = inject(DriversService);
  private readonly orders = inject(OrdersService);
  private readonly delivery = inject(DeliveryStatsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({ pageSize: 10, filters: ['status', 'driverId'] });

  /** The URL keeps "open" implicit (clean default link); the API wants it explicit and "all" as no filter. */
  private readonly apiQuery = computed<ListQuery>(
    () => {
      const q = this.state.query();
      const { status, ...rest } = q.filters;
      const effective = status === ALL ? null : (status ?? 'open');
      return { ...q, filters: effective ? { ...rest, status: effective } : rest };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly list = createListResource(this.apiQuery, (q) => this.problems.list(q));

  private readonly driverLookup = createQueryResource(signal(true), () => this.drivers.lookup(), {
    errorMessage: 'تعذّر تحميل المناديب',
  });

  protected readonly resolving = signal<ResolveTarget | null>(null);
  protected readonly assigning = signal<AssignTarget | null>(null);
  protected readonly busyId = signal<string | null>(null);

  protected readonly statusView = ORDER_PROBLEM_STATUS_VIEW;
  protected readonly orderStatusView = ORDER_STATUS_VIEW;
  protected readonly statusOf = problemStatus;
  protected readonly isOpen = isProblemOpen;
  protected readonly actionsOf = problemActions;
  protected readonly phone = toLocalMobile;
  protected readonly tel = telHref;
  protected readonly relative = formatRelative;
  protected readonly dateTime = formatDateTime;

  protected readonly tabs = computed<StatusTab[]>(() => [
    { value: null, label: 'مفتوحة', color: 'var(--am)', count: this.delivery.stats()?.openProblems ?? null },
    { value: 'resolved', label: 'تم الرد', color: 'var(--gr)', count: null },
    { value: ALL, label: 'الكل', color: 'var(--primary)', count: null },
  ]);

  /** Active drivers, plus the filtered one when it is no longer in the lookup (suspended / deleted). */
  protected readonly driverOptions = computed<FilterOption[]>(() => {
    const options = (this.driverLookup.value() ?? []).map((d) => ({ value: d.id, label: d.name }));
    const selected = this.state.query().filters['driverId'];
    if (selected && !options.some((o) => o.value === selected)) {
      const name = this.list.items().find((p) => p.driverId === selected)?.driverName ?? 'مندوب غير نشط';
      options.unshift({ value: selected, label: name });
    }
    return options;
  });

  private readonly orderCell = viewChild.required<TemplateRef<{ $implicit: OrderProblem }>>('orderCell');
  private readonly customerCell = viewChild.required<TemplateRef<{ $implicit: OrderProblem }>>('customerCell');
  private readonly driverCell = viewChild.required<TemplateRef<{ $implicit: OrderProblem }>>('driverCell');
  private readonly reasonCell = viewChild.required<TemplateRef<{ $implicit: OrderProblem }>>('reasonCell');
  private readonly sinceCell = viewChild.required<TemplateRef<{ $implicit: OrderProblem }>>('sinceCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: OrderProblem }>>('statusCell');

  protected readonly columns = computed<TableColumn<OrderProblem>[]>(() => [
    { key: 'orderNumber', label: 'الطلب', cellTemplate: this.orderCell() },
    { key: 'customerName', label: 'العميل', cellTemplate: this.customerCell() },
    { key: 'driverName', label: 'المندوب', cellTemplate: this.driverCell() },
    { key: 'reason', label: 'البلاغ', cellTemplate: this.reasonCell() },
    { key: 'createdAt', label: 'منذ', cellTemplate: this.sinceCell() },
    { key: 'resolvedAt', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
  ]);

  protected refresh(): void {
    this.list.reload();
    this.delivery.refresh();
  }

  protected run(p: OrderProblem, action: ProblemAction): void {
    switch (action) {
      case 'resolve':
        this.resolving.set(toResolveTarget(p));
        break;
      case 'reassign':
        this.reassign(toResolveTarget(p));
        break;
      case 'cancel':
        void this.cancelOrder(toResolveTarget(p));
        break;
      case 'order':
        this.openOrder(p);
        break;
    }
  }

  protected openOrder(p: Pick<OrderProblem, 'orderId'>): void {
    this.router.navigate(['/orders'], { queryParams: { order: p.orderId } });
  }

  protected reassign(t: ResolveTarget): void {
    this.resolving.set(null);
    this.assigning.set({ id: t.orderId, number: t.orderNumber, driverId: t.problem.driverId });
  }

  protected onResolved(): void {
    this.resolving.set(null);
    this.refresh();
  }

  protected onAssigned(): void {
    this.assigning.set(null);
    this.toast.info('تم إغلاق البلاغ تلقائيًا بعد تحويل الطلب');
    this.refresh();
  }

  protected onStale(): void {
    this.resolving.set(null);
    this.assigning.set(null);
    this.refresh();
  }

  protected async cancelOrder(t: ResolveTarget): Promise<void> {
    this.resolving.set(null);
    if (!canCancelOrder(t.orderStatus)) {
      this.toast.warning('الطلب في الطريق مع المندوب ولا يمكن إلغاؤه — رد على البلاغ بالتعليمات بدلًا من ذلك');
      return;
    }
    const confirmed = await this.dialog.confirm({
      title: 'إلغاء الطلب',
      message: `سيتم إلغاء الطلب ${t.orderNumber} وإغلاق البلاغ، ويصل إشعار للمندوب وللعميل. لا يمكن التراجع. هل تريد المتابعة؟`,
      confirmText: 'إلغاء الطلب',
      type: 'danger',
    });
    if (!confirmed) return;
    this.busyId.set(t.problem.id);
    this.orders
      .changeStatus(t.orderId, { status: 'cancelled' })
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          this.toast.success(`تم إلغاء الطلب ${t.orderNumber} وإغلاق البلاغ — وتم إشعار المندوب والعميل`);
          this.refresh();
        },
        error: (err: ApiError) => {
          this.toast.error(err.message);
          this.refresh();
        },
      });
  }
}

function toResolveTarget(p: OrderProblem): ResolveTarget {
  return { problem: p, orderId: p.orderId, orderNumber: p.orderNumber, orderStatus: p.orderStatus };
}
