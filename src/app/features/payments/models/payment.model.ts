import { StatusView } from '../../../shared/models/status-tone.model';
import { IconName } from '../../../shared/components/icon/icon.component';

/**
 * Online-store payments: every attempt to collect an order's value through a
 * gateway (card, wallet, InstaPay, Fawry) or by the courier on delivery (COD),
 * with its fees, refunds and settlement into the store's bank account.
 *
 * The list returns `PaymentSummary`; `GET payments/:id` returns the full
 * `Payment` with refunds and timeline.
 */

export type StorePaymentMethod = 'card' | 'wallet' | 'instapay' | 'fawry' | 'cod';
export type StorePaymentStatus = 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
export type SettlementStatus = 'unsettled' | 'settled';
/** List filter on settlement (`overdue` = past its expected date and still unsettled). */
export type SettlementFilter = SettlementStatus | 'overdue';

export interface PaymentSummary {
  id: string;
  /** `PAY-000123`. */
  number: string;
  /** ISO timestamp of the attempt. */
  createdAt: string;
  /** ISO timestamp the money was captured / collected. */
  paidAt: string | null;

  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  city: string;

  method: StorePaymentMethod;
  /** Gateway / wallet / courier name (Paymob, فودافون كاش، بوسطة…). */
  provider: string;
  /** Gateway transaction id, Fawry code, courier waybill… */
  reference: string;
  cardLast4: string | null;
  /** 1 = first attempt on this order. */
  attempt: number;

  /** Gross amount charged / to collect. */
  amount: number;
  /** Gateway / courier commission (not returned on refunds). */
  fee: number;
  refunded: number;
  /** amount − fee − refunded. */
  net: number;

  status: StorePaymentStatus;
  failureReason: string | null;

  /** `null` until the money is captured. */
  settlementStatus: SettlementStatus | null;
  /** ISO date the gateway / courier is expected to transfer. */
  expectedSettlementDate: string | null;
  settledAt: string | null;
  settlementBatch: string | null;
}

export interface PaymentRefund {
  id: string;
  at: string;
  amount: number;
  reason: string;
  by: string;
}

export type PaymentEventType = 'created' | 'paid' | 'failed' | 'retry' | 'refund' | 'settled';

export interface PaymentEvent {
  type: PaymentEventType;
  at: string;
  by: string;
  note?: string;
  amount?: number;
}

export interface Payment extends PaymentSummary {
  refunds: PaymentRefund[];
  timeline: PaymentEvent[];
}

export interface PaymentStats {
  count: number;
  byStatus: Record<StorePaymentStatus, number>;
  /** Σ amount of captured payments (paid / partially refunded / refunded). */
  collected: number;
  /** Σ amount still awaiting collection. */
  pending: number;
  pendingCount: number;
  fees: number;
  refunds: number;
  /** collected − fees − refunds. */
  net: number;
  /** Σ net of captured payments not yet settled. */
  unsettled: number;
  unsettledCount: number;
  overdueCount: number;
}

// ── Action payloads ──

export interface ConfirmPaymentPayload {
  reference?: string;
  note?: string;
}

export interface FailPaymentPayload {
  reason: string;
}

export interface RefundPaymentPayload {
  amount: number;
  reason: string;
}

export interface SettlePaymentPayload {
  batch?: string;
}

// ── Display maps ──

export const STORE_PAYMENT_STATUSES: readonly StorePaymentStatus[] = ['pending', 'paid', 'partially_refunded', 'refunded', 'failed'];

export const STORE_PAYMENT_STATUS_VIEW: Record<StorePaymentStatus, StatusView> = {
  pending: { label: 'قيد التحصيل', tone: 'warning', color: 'var(--am)' },
  paid: { label: 'مدفوع', tone: 'good', color: 'var(--gr)' },
  partially_refunded: { label: 'مسترد جزئيًا', tone: 'info', color: 'var(--bl)' },
  refunded: { label: 'مسترد', tone: 'neutral', color: 'var(--txt3)' },
  failed: { label: 'فشل', tone: 'danger', color: 'var(--re)' },
};

export const STORE_PAYMENT_METHODS: readonly StorePaymentMethod[] = ['card', 'wallet', 'instapay', 'fawry', 'cod'];

export interface PaymentMethodView {
  label: string;
  icon: IconName;
  color: string;
}

export const STORE_PAYMENT_METHOD_VIEW: Record<StorePaymentMethod, PaymentMethodView> = {
  card: { label: 'بطاقة بنكية', icon: 'wallet', color: 'var(--bl)' },
  wallet: { label: 'محفظة إلكترونية', icon: 'coins', color: 'var(--re)' },
  instapay: { label: 'إنستاباي', icon: 'bolt', color: 'var(--pu)' },
  fawry: { label: 'فوري', icon: 'receipt', color: 'var(--am)' },
  cod: { label: 'الدفع عند الاستلام', icon: 'truck', color: 'var(--gr)' },
};

export const SETTLEMENT_VIEW: Record<SettlementStatus, StatusView> = {
  unsettled: { label: 'بانتظار التسوية', tone: 'warning', color: 'var(--am)' },
  settled: { label: 'تمت التسوية', tone: 'good', color: 'var(--gr)' },
};

export const SETTLEMENT_FILTERS: ReadonlyArray<{ value: SettlementFilter; label: string }> = [
  { value: 'unsettled', label: 'بانتظار التسوية' },
  { value: 'overdue', label: 'متأخرة عن موعد التسوية' },
  { value: 'settled', label: 'تمت التسوية' },
];

export const PAYMENT_EVENT_VIEW: Record<PaymentEventType, { label: string; color: string }> = {
  created: { label: 'إنشاء عملية الدفع', color: 'var(--txt3)' },
  paid: { label: 'تم التحصيل', color: 'var(--gr)' },
  failed: { label: 'فشل الدفع', color: 'var(--re)' },
  retry: { label: 'إعادة محاولة التحصيل', color: 'var(--am)' },
  refund: { label: 'استرداد', color: 'var(--bl)' },
  settled: { label: 'تسوية مع البوابة', color: 'var(--pu)' },
};

/** Captured money exists (the payment can be refunded / settled). */
export function isCaptured(status: StorePaymentStatus): boolean {
  return status === 'paid' || status === 'partially_refunded' || status === 'refunded';
}

export function canRefund(p: Pick<PaymentSummary, 'status' | 'amount' | 'refunded'>): boolean {
  return (p.status === 'paid' || p.status === 'partially_refunded') && refundable(p) > 0;
}

export function refundable(p: Pick<PaymentSummary, 'amount' | 'refunded'>): number {
  return Math.max(0, Math.round((p.amount - p.refunded) * 100) / 100);
}

export function canSettle(p: Pick<PaymentSummary, 'status' | 'settlementStatus'>): boolean {
  return isCaptured(p.status) && p.settlementStatus === 'unsettled';
}

/** Only courier collections (COD) can be re-attempted; gateway failures need a new payment from the customer. */
export function canRetry(p: Pick<PaymentSummary, 'status' | 'method'>): boolean {
  return p.status === 'failed' && p.method === 'cod';
}

export function isSettlementOverdue(p: Pick<PaymentSummary, 'settlementStatus' | 'expectedSettlementDate'>, today: string): boolean {
  return p.settlementStatus === 'unsettled' && !!p.expectedSettlementDate && p.expectedSettlementDate < today;
}
