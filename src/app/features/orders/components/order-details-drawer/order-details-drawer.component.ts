import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DrawerComponent } from '../../../../shared/components/drawer/drawer.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { formatDateTime, formatMoney } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import {
  canAssignDriver,
  canCancelOrder,
  canUnassignDriver,
  driverRequiredReason,
  CHANNEL_LABEL,
  nextOrderStatus,
  notifiesCustomer,
  Order,
  ORDER_ADVANCE_LABEL,
  ORDER_ERROR_CODES,
  ORDER_INVOICE_STATUS_VIEW,
  OrderInvoice,
  ORDER_ITEMS_PLURAL,
  ORDER_STATUS_VIEW,
  OrderAction,
  orderActions,
  OrderStatus,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_VIEW,
} from '../../models/order.model';
import { OrdersService } from '../../services/orders.service';
import { OrderPrintService } from '../../services/order-print.service';
import { OrderProgressComponent } from '../order-progress/order-progress.component';
import { ApiError } from '../../../../core/models/api-response.model';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { runDrawerIntent } from '../../../../shared/utils/drawer-intent.util';
import { formatRelative } from '../../../../shared/utils/format.util';
import { telHref, toLocalMobile } from '../../../../shared/utils/phone.util';
import { AssignDriverModalComponent, AssignTarget } from '../../../drivers/components/assign-driver-modal/assign-driver-modal.component';
import { ResolveProblemModalComponent, ResolveTarget } from '../../../drivers/components/resolve-problem-modal/resolve-problem-modal.component';
import { isProblemOpen, OrderProblemBase } from '../../../drivers/models/order-problem.model';
import { DeliveryStatsService } from '../../../drivers/services/delivery-stats.service';
import { RouterLink } from '@angular/router';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { DOC_KIND_CONFIG } from '../../../documents/models/document.model';
import { DeliveryBadgeComponent } from '../../../delivery-zones/components/delivery-badge/delivery-badge.component';
import { isExpress } from '../../../delivery-zones/models/delivery-type.model';

/** What to do now with an open express order, by status — `null` once it's out for delivery or closed. */
const EXPRESS_NEXT_STEP: Partial<Record<OrderStatus, string>> = {
  pending: 'أكّد الطلب وابدأ تجهيزه فورًا، ثم عيّن له مندوبًا.',
  processing: 'جهّز الطلب وسلّمه للمندوب في أسرع وقت.',
};

/** Full order view in a side drawer: fulfilment actions, the assigned driver and its delivery problems. */
@Component({
  selector: 'app-order-details-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AssignDriverModalComponent,
    AvatarComponent,
    DeliveryBadgeComponent,
    DrawerComponent,
    IconComponent,
    OrderProgressComponent,
    ResolveProblemModalComponent,
    StatusPillComponent,
  ],
  templateUrl: './order-details-drawer.component.html',
  styleUrl: './order-details-drawer.component.scss',
})
export class OrderDetailsDrawerComponent {
  private readonly orders = inject(OrdersService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly delivery = inject(DeliveryStatsService);
  private readonly auth = inject(AuthService);
  protected readonly printer = inject(OrderPrintService);

  /** Open when set — bound to the `order` URL param by the page. */
  readonly orderId = input<string | null>(null);
  readonly closed = output<void>();
  /** Emitted after a status change (or a stale-status conflict) so the page can refresh its list. */
  readonly changed = output<void>();
  /** Action requested from the table row — run once the order has loaded. */
  readonly intent = input<OrderAction | null>(null);
  readonly intentDone = output<void>();

  constructor() {
    runDrawerIntent(this.current, this.intent, (o, action) => this.runAction(o, action), () => this.intentDone.emit());
  }

  /** Single entry for an action, from a table row (the footer calls the same methods). */
  private runAction(order: Order, action: OrderAction): void {
    const available = orderActions(driverFields(order)).find((a) => a.key === action);
    if (!available) {
      this.toast.info(`لم يعد هذا الإجراء متاحًا — حالة الطلب ${order.number} الآن «${ORDER_STATUS_VIEW[order.status].label}»`);
      return;
    }
    if (available.disabledReason) {
      this.requireDriver(order, available.disabledReason);
      return;
    }
    switch (action) {
      case 'advance':
        void this.advance(order);
        break;
      case 'assign':
        this.openAssign(order);
        break;
      case 'unassign':
        void this.unassign(order);
        break;
      case 'print':
        this.printer.print(order);
        break;
      case 'cancel':
        void this.cancel(order);
        break;
    }
  }

  /** `orderId` may be an id or an order number (dashboard / shared links) — both open the order. */
  protected readonly order = createQueryResource(this.orderId, (key) => this.orders.resolve(key!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل الطلب',
  });
  protected readonly busy = signal<OrderStatus | 'unassign' | null>(null);
  protected readonly assigning = signal<AssignTarget | null>(null);
  protected readonly resolving = signal<ResolveTarget | null>(null);

  /** Shows the old order only while it is the one requested (no flash of the previous order). */
  protected readonly current = computed(() => {
    const o = this.order.value();
    const key = this.orderId();
    return o && (o.id === key || o.number === key) ? o : null;
  });
  protected readonly next = computed(() => {
    const o = this.current();
    return o ? nextOrderStatus(o.status) : null;
  });
  protected readonly cancellable = computed(() => {
    const o = this.current();
    return !!o && canCancelOrder(o.status);
  });
  /** App order with an action left → warn that acting on it notifies the customer. */
  protected readonly showNotifyHint = computed(() => {
    const o = this.current();
    return !!o && notifiesCustomer(o.channel) && (!!this.next() || this.cancellable());
  });
  protected readonly assignable = computed(() => {
    const o = this.current();
    return !!o && canAssignDriver(o.status);
  });
  protected readonly unassignable = computed(() => {
    const o = this.current();
    return !!o && canUnassignDriver(o.status);
  });
  /** Why the next status is locked (no driver yet), or `null`. */
  protected readonly locked = computed(() => {
    const o = this.current();
    return o ? driverRequiredReason(driverFields(o)) : null;
  });
  /** Newest first; open ones are highlighted in the template. */
  protected readonly problems = computed(() =>
    [...(this.current()?.problems ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  /** Server-issued sales invoices — shown once delivered (or whenever there are some). */
  protected readonly invoices = computed(() => this.current()?.invoices ?? []);
  protected readonly showInvoices = computed(() => this.current()?.status === 'delivered' || this.invoices().length > 0);
  /** Sum of the live invoices — excludes shipping, so it may be below the order total. */
  protected readonly invoicedTotal = computed(() =>
    this.invoices()
      .filter((i) => i.status !== 'cancelled')
      .reduce((sum, i) => sum + i.total, 0),
  );
  /** Opening a document needs the invoices screen (Invoices.View); otherwise the number is plain text. */
  protected readonly canOpenInvoices = computed(() => this.auth.hasPermission(PERMISSIONS.invoices));
  protected readonly invoiceRoute = DOC_KIND_CONFIG.sale.route;
  protected readonly invoiceStatusView = ORDER_INVOICE_STATUS_VIEW;

  protected readonly openProblems = computed(() => this.problems().filter(isProblemOpen).length);

  /**
   * Express orders must be prepared and dispatched first — a loud banner while
   * there is still something to do (pending / processing), with the next step.
   */
  protected readonly expressAlert = computed(() => {
    const o = this.current();
    if (!o || !isExpress(o.delivery)) return null;
    const step = EXPRESS_NEXT_STEP[o.status];
    if (!step) return null;
    const needsDriver = o.status === 'processing' && !o.driverId;
    return { step: needsDriver ? 'عيّن مندوبًا الآن — الطلب مؤكد وبانتظار التوصيل السريع.' : step, needsDriver };
  });

  /** Last real step before a cancellation, so the stepper shows how far it got. */
  protected readonly lastStep = computed(() => {
    const t = this.current()?.timeline ?? [];
    return t.length > 1 ? t[t.length - 2].status : null;
  });

  protected readonly statusView = ORDER_STATUS_VIEW;
  protected readonly paymentView = PAYMENT_STATUS_VIEW;
  protected readonly channel = CHANNEL_LABEL;
  protected readonly method = PAYMENT_METHOD_LABEL;
  protected readonly advanceLabel = ORDER_ADVANCE_LABEL;
  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;
  protected readonly items = (n: number) => pluralAr(n, ORDER_ITEMS_PLURAL);
  protected readonly relative = formatRelative;
  protected readonly phone = toLocalMobile;
  protected readonly tel = telHref;
  protected readonly isOpen = isProblemOpen;

  // ── Driver ──

  protected openAssign(order: Order): void {
    if (!canAssignDriver(order.status)) {
      this.toast.info(order.status === 'pending' ? 'أكّد الطلب أولًا، ثم عيّن المندوب' : 'لا يمكن تعيين مندوب لطلب مغلق');
      return;
    }
    this.assigning.set({ id: order.id, number: order.number, driverId: order.driver?.id ?? order.driverId });
  }

  protected onAssigned(): void {
    this.assigning.set(null);
    this.afterChange();
  }

  protected async unassign(order: Order): Promise<void> {
    const name = order.driver?.name ?? order.driverName ?? 'المندوب';
    const confirmed = await this.dialog.confirm({
      title: 'إلغاء تعيين المندوب',
      message: `سيتم سحب الطلب ${order.number} من ${name} ويصله إشعار بذلك، وتُغلق بلاغاته المفتوحة على الطلب. هل تريد المتابعة؟`,
      confirmText: 'إلغاء التعيين',
      type: 'warning',
    });
    if (!confirmed) return;
    this.busy.set('unassign');
    this.orders
      .assignDriver(order.id, null)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: () => {
          this.toast.success(`تم سحب الطلب من ${name} — الطلب الآن بدون مندوب`);
          this.afterChange();
        },
        error: (err: ApiError) => {
          this.toast.error(err.message);
          if (err.status === 409) this.afterChange();
        },
      });
  }

  // ── Delivery problems ──

  protected openResolve(order: Order, problem: OrderProblemBase): void {
    this.resolving.set({ problem, orderId: order.id, orderNumber: order.number, orderStatus: order.status });
  }

  protected onResolved(): void {
    this.resolving.set(null);
    this.afterChange();
  }

  protected reassignFromProblem(): void {
    this.resolving.set(null);
    const o = this.current();
    if (o) this.openAssign(o);
  }

  protected cancelFromProblem(): void {
    this.resolving.set(null);
    const o = this.current();
    if (o) void this.cancel(o);
  }

  /** Something moved the order or its counters: reload it, the list, and the delivery badges. */
  protected afterChange(): void {
    this.order.reload();
    this.changed.emit();
    this.delivery.refresh();
  }

  protected async advance(order: Order): Promise<void> {
    const status = nextOrderStatus(order.status);
    if (!status) return;
    const locked = driverRequiredReason(driverFields(order));
    if (locked) return this.requireDriver(order, locked);
    if (status === 'delivered') {
      // Delivery is final: the server issues and posts the sales invoice and deducts the stock.
      const confirmed = await this.dialog.confirm({
        title: 'تأكيد تسليم الطلب',
        message: `سيتم تسجيل تسليم الطلب ${order.number} وإنشاء فاتورة مبيعات له تلقائيًا وخصم الكميات من المخزن. لا يمكن التراجع عن التسليم. هل تريد المتابعة؟`,
        confirmText: 'تأكيد التسليم',
        type: 'warning',
      });
      if (!confirmed) return;
    }
    this.apply(order, status, `تم تحديث الطلب إلى «${ORDER_STATUS_VIEW[status].label}»`);
  }

  protected async cancel(order: Order): Promise<void> {
    const driver = order.driver?.name ?? order.driverName;
    const notices = [
      notifiesCustomer(order.channel) ? 'سيصل للعميل إشعار بالإلغاء على تطبيق الموبايل.' : '',
      driver ? `وسيصل إشعار للمندوب ${driver} وتُغلق بلاغاته المفتوحة.` : '',
    ].filter(Boolean);
    const notice = notices.length ? `\n${notices.join(' ')}` : '';
    const confirmed = await this.dialog.confirm({
      title: 'إلغاء الطلب',
      message: `سيتم إلغاء الطلب ${order.number} ولن يمكن التراجع. هل تريد المتابعة؟${notice}`,
      confirmText: 'إلغاء الطلب',
      type: 'danger',
    });
    if (confirmed) this.apply(order, 'cancelled', 'تم إلغاء الطلب');
  }

  private apply(order: Order, status: OrderStatus, message: string): void {
    this.busy.set(status);
    this.orders
      .changeStatus(order.id, { status })
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: (updated) => {
          this.toast.success(notifiesCustomer(order.channel) ? `${message} — وتم إشعار العميل` : message);
          if (status === 'delivered') this.reportInvoices(updated.invoices ?? []);
          this.afterChange();
          // Confirmed: the natural next step is picking the driver.
          if (status === 'processing' && !updated.driverId && !updated.driver) {
            this.assigning.set({ id: updated.id, number: updated.number, driverId: null });
          }
        },
        error: (err: ApiError) => {
          this.toast.error(err.message);
          // Someone else moved the order: show its real status and the actions it allows now.
          if (hasErrorCode(err, ORDER_ERROR_CODES.invalidTransition) || err.status === 409) this.afterChange();
        },
      });
  }

  /** The step is locked until a driver is assigned: say why and go straight to picking one. */
  private requireDriver(order: Order, reason: string): void {
    this.toast.warning(reason);
    this.openAssign(order);
  }

  /** What happened to the automatic sales invoice — the reason for a missing / draft one is in the timeline note. */
  private reportInvoices(invoices: readonly OrderInvoice[]): void {
    const numbers = (list: readonly OrderInvoice[]) => list.map((i) => i.number).join('، ');
    const drafts = invoices.filter((i) => i.status === 'draft');
    const posted = invoices.filter((i) => i.status === 'posted');
    if (!invoices.length) {
      this.toast.warning('لم تُنشأ فاتورة مبيعات لهذا الطلب — السبب في ملاحظة «تم التسليم» في سجل الطلب');
    } else if (drafts.length) {
      this.toast.warning(`فاتورة المبيعات ${numbers(drafts)} اتعملت مسودة لأن المخزون لم يكفِ — راجعها ورحّلها من شاشة فواتير المبيعات`);
    } else if (posted.length) {
      this.toast.info(`تم إنشاء وترحيل فاتورة المبيعات ${numbers(posted)} وخصم الكميات من المخزن`);
    }
  }
}

/** The list row and the details carry the driver differently — read it from either. */
function driverFields(o: Order): Pick<Order, 'status' | 'driverId'> {
  return { status: o.status, driverId: o.driverId ?? o.driver?.id ?? null };
}
