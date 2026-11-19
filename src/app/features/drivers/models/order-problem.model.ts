import { StatusView } from '../../../shared/models/status-tone.model';
import type { OrderStatus } from '../../orders/models/order.model';

/**
 * A delivery problem a driver reported on an order (`/api/order-problems`).
 * Closed by an admin reply, by moving the order to another driver, by
 * cancelling it, or automatically when the order is delivered.
 */
export type OrderProblemReason =
  | 'customer_unreachable'
  | 'customer_refused'
  | 'customer_postponed'
  | 'wrong_address'
  | 'damaged_items'
  | 'other';

/** Fields shared by the problems list and the problems inside an order. */
export interface OrderProblemBase {
  id: string;
  reason: OrderProblemReason;
  /** Ready Arabic label from the server — prefer it over the local map. */
  reasonLabel: string;
  note: string;
  driverId: string;
  driverName: string;
  createdAt: string;
  /** `null` = still open. */
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
}

export interface OrderProblem extends OrderProblemBase {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  customerName: string;
  customerPhone: string;
}

export type OrderProblemStatus = 'open' | 'resolved';

export const isProblemOpen = (p: Pick<OrderProblemBase, 'resolvedAt'>): boolean => !p.resolvedAt;

export const ORDER_PROBLEM_STATUS_VIEW: Record<OrderProblemStatus, StatusView> = {
  open: { label: 'مفتوح', tone: 'warning', color: 'var(--am)' },
  resolved: { label: 'تم الرد', tone: 'good', color: 'var(--gr)' },
};

export const problemStatus = (p: Pick<OrderProblemBase, 'resolvedAt'>): OrderProblemStatus =>
  isProblemOpen(p) ? 'open' : 'resolved';

/** Fallback labels (filters); rows carry `reasonLabel`. */
export const ORDER_PROBLEM_REASON_LABEL: Record<OrderProblemReason, string> = {
  customer_unreachable: 'العميل لا يرد',
  customer_refused: 'العميل رفض الاستلام',
  customer_postponed: 'العميل طلب التأجيل',
  wrong_address: 'العنوان غير صحيح',
  damaged_items: 'المنتجات تالفة',
  other: 'أخرى',
};

export const ORDER_PROBLEM_ERROR_CODES = {
  /** Someone replied first — reload. */
  alreadyResolved: 'PROBLEM_ALREADY_RESOLVED',
} as const;
