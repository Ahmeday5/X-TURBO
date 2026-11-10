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
  canCancelOrder,
  CHANNEL_LABEL,
  nextOrderStatus,
  notifiesCustomer,
  Order,
  ORDER_ADVANCE_LABEL,
  ORDER_ERROR_CODES,
  ORDER_ITEMS_PLURAL,
  ORDER_STATUS_VIEW,
  OrderStatus,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_VIEW,
} from '../../models/order.model';
import { OrdersService } from '../../services/orders.service';
import { OrderProgressComponent } from '../order-progress/order-progress.component';
import { ApiError } from '../../../../core/models/api-response.model';
import { hasErrorCode } from '../../../../core/http/api-error-codes';

/** Full order view in a side drawer, with the next fulfilment action and cancel. */
@Component({
  selector: 'app-order-details-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, DrawerComponent, IconComponent, StatusPillComponent, OrderProgressComponent],
  templateUrl: './order-details-drawer.component.html',
  styleUrl: './order-details-drawer.component.scss',
})
export class OrderDetailsDrawerComponent {
  private readonly orders = inject(OrdersService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  /** Open when set — bound to the `order` URL param by the page. */
  readonly orderId = input<string | null>(null);
  readonly closed = output<void>();
  /** Emitted after a status change (or a stale-status conflict) so the page can refresh its list. */
  readonly changed = output<void>();

  protected readonly order = createQueryResource(this.orderId, (id) => this.orders.get(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل الطلب',
  });
  protected readonly busy = signal<OrderStatus | null>(null);

  /** Shows the old order only while it is the one requested (no flash of the previous order). */
  protected readonly current = computed(() => {
    const o = this.order.value();
    return o && o.id === this.orderId() ? o : null;
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

  protected advance(order: Order): void {
    const status = nextOrderStatus(order.status);
    if (status) this.apply(order, status, `تم تحديث الطلب إلى «${ORDER_STATUS_VIEW[status].label}»`);
  }

  protected async cancel(order: Order): Promise<void> {
    const notice = notifiesCustomer(order.channel) ? '\nسيصل للعميل إشعار بالإلغاء على تطبيق الموبايل.' : '';
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
        next: () => {
          this.toast.success(notifiesCustomer(order.channel) ? `${message} — وتم إشعار العميل` : message);
          this.order.reload();
          this.changed.emit();
        },
        error: (err: ApiError) => {
          this.toast.error(err.message);
          // Someone else moved the order: show its real status and the actions it allows now.
          if (hasErrorCode(err, ORDER_ERROR_CODES.invalidTransition) || err.status === 409) {
            this.order.reload();
            this.changed.emit();
          }
        },
      });
  }
}
