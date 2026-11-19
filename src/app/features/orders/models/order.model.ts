import { RowAction } from '../../../shared/models/row-action.model';
import { StatusView } from '../../../shared/models/status-tone.model';
import { ArabicPluralForms } from '../../../shared/utils/plural.util';
import type { OrderProblemBase } from '../../drivers/models/order-problem.model';

/**
 * Wire contract of the orders API. The list returns `OrderSummary` rows;
 * `GET orders/:id` returns the full `Order` with lines and timeline.
 */

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type OrderChannel = 'online' | 'pos' | 'wholesale';
export type PaymentMethod = 'cash' | 'card' | 'wallet' | 'credit';
export type PaymentStatus = 'paid' | 'unpaid' | 'refunded';
export type OrderPeriod = 'today' | '7d' | '30d' | '90d';

export interface OrderSummary {
  id: string;
  /** Human-facing number, e.g. `ORD-10482`. */
  number: string;
  customerName: string;
  customerPhone: string;
  city: string;
  channel: OrderChannel;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  itemCount: number;
  total: number;
  /** ISO timestamp. */
  createdAt: string;
  /** Assigned delivery driver — `null` when none. */
  driverId: string | null;
  driverName: string | null;
  /** A driver reported a delivery problem nobody answered yet. */
  hasOpenProblem: boolean;
}

export interface OrderLine {
  itemId: string;
  code: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface OrderEvent {
  status: OrderStatus;
  at: string;
  by: string;
  note?: string;
}

export interface AssignedDriver {
  id: string;
  name: string;
  phone: string;
  assignedAt: string;
}

/** Status of the sales invoice the server issues when the order is delivered. */
export type OrderInvoiceStatus = 'posted' | 'draft' | 'cancelled';

/**
 * Sales invoice issued (and posted) by the server on delivery — one per
 * warehouse the items came from. Shipping is not invoiced, so the invoices
 * may total less than the order.
 */
export interface OrderInvoice {
  /** Document id — opens in the sales invoices screen. */
  id: string;
  number: string;
  status: OrderInvoiceStatus;
  warehouseId: string;
  warehouseName: string;
  total: number;
}

export const ORDER_INVOICE_STATUS_VIEW: Record<OrderInvoiceStatus, StatusView> = {
  posted: { label: 'مُرحّلة', tone: 'good', color: 'var(--gr)' },
  // Stock was short at delivery: still counted in "reserved" until someone posts or cancels it.
  draft: { label: 'مسودة — تحتاج مراجعة', tone: 'warning', color: 'var(--am)' },
  cancelled: { label: 'ملغاة', tone: 'neutral', color: 'var(--txt3)' },
};

export interface Order extends OrderSummary {
  address: string;
  subtotal: number;
  discount: number;
  shipping: number;
  note: string;
  lines: OrderLine[];
  timeline: OrderEvent[];
  driver: AssignedDriver | null;
  /** Delivery problems reported by drivers on this order. */
  problems: OrderProblemBase[];
  /** Empty until delivered; then usually one (one per source warehouse). */
  invoices: OrderInvoice[];
}

export interface OrderStats {
  count: number;
  revenue: number;
  avgValue: number;
  byStatus: Record<OrderStatus, number>;
}

export interface OrderStatusChange {
  status: OrderStatus;
  note?: string;
}

// ── Display maps (single source for every screen that shows orders) ──

export const ORDER_STATUSES: readonly OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export const ORDER_STATUS_VIEW: Record<OrderStatus, StatusView> = {
  pending: { label: 'قيد الانتظار', tone: 'warning', color: 'var(--am)' },
  processing: { label: 'قيد التجهيز', tone: 'info', color: 'var(--bl)' },
  shipped: { label: 'تم الشحن', tone: 'info', color: 'var(--pu)' },
  delivered: { label: 'تم التسليم', tone: 'good', color: 'var(--gr)' },
  cancelled: { label: 'ملغي', tone: 'danger', color: 'var(--re)' },
};

/** Happy path, in order. `cancelled` is a side exit, not a step. */
export const ORDER_FLOW: readonly OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(status);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;
}

export function canCancelOrder(status: OrderStatus): boolean {
  return status === 'pending' || status === 'processing';
}

/** Business-rule codes the orders API answers with (409). */
export const ORDER_ERROR_CODES = {
  /** Status change not allowed from the order's CURRENT status (it may have moved meanwhile). */
  invalidTransition: 'ORDER_INVALID_TRANSITION',
  /** Driver assignment on a `pending` order — confirm it first. */
  notConfirmed: 'ORDER_NOT_CONFIRMED',
  /** Driver change on a delivered / cancelled order. */
  closed: 'ORDER_CLOSED',
} as const;

/**
 * Mobile-app orders: every status change pushes a notification to the
 * customer's phone (processing / shipped / delivered / cancelled).
 */
export function notifiesCustomer(channel: OrderChannel): boolean {
  return channel === 'online';
}

/** Verb for the button that moves an order to `status`. */
export const ORDER_ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  processing: 'تأكيد الطلب',
  shipped: 'تأكيد الشحن',
  delivered: 'تأكيد التسليم',
};

/** A driver can be assigned / changed once the order is confirmed and until it closes. */
export function canAssignDriver(status: OrderStatus): boolean {
  return status === 'processing' || status === 'shipped';
}

/**
 * Taking the driver off is allowed only before pickup: a shipped order is in
 * the driver's hands — change the driver instead, it can never be driverless.
 */
export function canUnassignDriver(status: OrderStatus): boolean {
  return status === 'processing';
}

type DriverFields = Pick<OrderSummary, 'status' | 'driverId'>;

/**
 * Fulfilment policy: once confirmed, an order moves forward (shipped →
 * delivered) only with a driver assigned. Confirming (pending → processing)
 * and cancelling are never blocked — a driver can only be picked after
 * confirmation. Returns why the next step is locked, or `null`.
 */
export function driverRequiredReason(o: DriverFields): string | null {
  if (o.driverId || !canAssignDriver(o.status)) return null;
  return o.status === 'processing'
    ? 'عيّن مندوبًا أولًا — لا يمكن شحن الطلب بدون مندوب'
    : 'عيّن مندوبًا أولًا — لا يمكن تأكيد التسليم بدون مندوب';
}

/** Confirmed order still waiting for its driver — flagged in the list and the details. */
export function awaitsDriver(o: DriverFields): boolean {
  return !!driverRequiredReason(o);
}

export type OrderAction = 'advance' | 'assign' | 'unassign' | 'print' | 'cancel';

/**
 * What can be done to an order now — the same list for its table row and its
 * drawer. Without a driver, "assign" is the primary step and the next status
 * is shown locked with the reason (see `driverRequiredReason`).
 */
export function orderActions(o: DriverFields): RowAction<OrderAction>[] {
  const next = nextOrderStatus(o.status);
  const assignable = canAssignDriver(o.status);
  const locked = driverRequiredReason(o);
  const actions: RowAction<OrderAction>[] = [];
  if (assignable && !o.driverId) {
    actions.push({ key: 'assign', label: 'تعيين مندوب', icon: 'truck', tone: 'primary' });
  }
  if (next && ORDER_ADVANCE_LABEL[next]) {
    actions.push({
      key: 'advance',
      label: ORDER_ADVANCE_LABEL[next]!,
      icon: 'check',
      ...(locked ? { disabledReason: locked } : { tone: 'primary' as const }),
    });
  }
  if (assignable && o.driverId) {
    actions.push({ key: 'assign', label: 'تغيير المندوب', icon: 'swap' });
    if (canUnassignDriver(o.status)) actions.push({ key: 'unassign', label: 'إلغاء تعيين المندوب', icon: 'user-x' });
  }
  actions.push({ key: 'print', label: 'طباعة الطلب', icon: 'file-lines' });
  if (canCancelOrder(o.status)) actions.push({ key: 'cancel', label: 'إلغاء الطلب', icon: 'x', tone: 'danger', separated: true });
  return actions;
}

export const ORDER_CHANNELS: readonly OrderChannel[] = ['online', 'pos', 'wholesale'];
export const CHANNEL_LABEL: Record<OrderChannel, string> = {
  online: 'المتجر الإلكتروني',
  pos: 'نقاط البيع',
  wholesale: 'الجملة',
};

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'card', 'wallet', 'credit'];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'نقدي',
  card: 'بطاقة',
  wallet: 'محفظة إلكترونية',
  credit: 'آجل',
};

export const PAYMENT_STATUSES: readonly PaymentStatus[] = ['paid', 'unpaid', 'refunded'];
export const PAYMENT_STATUS_VIEW: Record<PaymentStatus, StatusView> = {
  paid: { label: 'مدفوع', tone: 'good', color: 'var(--gr)' },
  unpaid: { label: 'غير مدفوع', tone: 'warning', color: 'var(--am)' },
  refunded: { label: 'مسترد', tone: 'neutral', color: 'var(--txt3)' },
};

export const ORDER_PERIODS: ReadonlyArray<{ value: OrderPeriod; label: string }> = [
  { value: 'today', label: 'اليوم' },
  { value: '7d', label: 'آخر 7 أيام' },
  { value: '30d', label: 'آخر 30 يومًا' },
  { value: '90d', label: 'آخر 90 يومًا' },
];

export const ORDER_ITEMS_PLURAL: ArabicPluralForms = {
  one: 'قطعة واحدة',
  two: 'قطعتان',
  few: '# قطع',
  other: '# قطعة',
};
