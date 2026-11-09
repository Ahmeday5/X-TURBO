import { StatusView } from '../../../shared/models/status-tone.model';
import { ArabicPluralForms } from '../../../shared/utils/plural.util';

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

export interface Order extends OrderSummary {
  address: string;
  subtotal: number;
  discount: number;
  shipping: number;
  note: string;
  lines: OrderLine[];
  timeline: OrderEvent[];
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

/** Verb for the button that moves an order to `status`. */
export const ORDER_ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  processing: 'بدء التجهيز',
  shipped: 'تأكيد الشحن',
  delivered: 'تأكيد التسليم',
};

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
