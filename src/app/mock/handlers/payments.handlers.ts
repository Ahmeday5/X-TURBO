import {
  ConfirmPaymentPayload,
  FailPaymentPayload,
  isCaptured,
  isSettlementOverdue,
  PaymentStats,
  PaymentSummary,
  RefundPaymentPayload,
  SettlePaymentPayload,
  STORE_PAYMENT_STATUSES,
  StorePaymentStatus,
} from '../../features/payments/models/payment.model';
import { PAYMENTS_ENDPOINTS } from '../../features/payments/services/payments.service';
import { actorName, inRange, round2, todayIso } from '../db/db-utils';
import {
  confirmPayment,
  failPayment,
  findPayment,
  paymentRows,
  refundPayment,
  retryPayment,
  settlePayment,
  toPaymentSummary,
} from '../db/payments.db';
import { bodyOf, CollectionOptions, filterCollection, queryCollection } from '../mock-collection';
import { MockContext, MockRoute, ok } from '../mock-http';

const LIST_OPTIONS: CollectionOptions<PaymentSummary> = {
  searchFields: ['number', 'orderNumber', 'customerName', 'customerPhone', 'reference', 'provider', 'settlementBatch', 'city'],
  filters: {
    status: (row, v) => row.status === v,
    method: (row, v) => row.method === v,
    orderId: (row, v) => row.orderId === v,
    settlement: (row, v) => (v === 'overdue' ? isSettlementOverdue(row, todayIso()) : row.settlementStatus === v),
  },
};

function filtered(query: URLSearchParams): PaymentSummary[] {
  const from = query.get('from');
  const to = query.get('to');
  return paymentRows()
    .filter((p) => inRange(localDate(p.createdAt), from, to))
    .map(toPaymentSummary);
}

/** Local calendar date of an ISO timestamp (date filters are local days). */
function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function list({ query }: MockContext) {
  if (!query.get('sortBy')) {
    query.set('sortBy', 'createdAt');
    query.set('sortDir', 'desc');
  }
  return ok(queryCollection(filtered(query), query, LIST_OPTIONS));
}

function stats({ query }: MockContext) {
  const q = new URLSearchParams(query);
  q.delete('status');
  const rows = filterCollection(filtered(q), q, LIST_OPTIONS);
  const today = todayIso();
  const captured = rows.filter((r) => isCaptured(r.status));
  const pending = rows.filter((r) => r.status === 'pending');
  const unsettled = captured.filter((r) => r.settlementStatus === 'unsettled');
  const total = (list: PaymentSummary[], pickFn: (r: PaymentSummary) => number) => round2(list.reduce((s, r) => s + pickFn(r), 0));

  const byStatus = Object.fromEntries(STORE_PAYMENT_STATUSES.map((s) => [s, 0])) as Record<StorePaymentStatus, number>;
  rows.forEach((r) => byStatus[r.status]++);

  const collected = total(captured, (r) => r.amount);
  const fees = total(captured, (r) => r.fee);
  const refunds = total(captured, (r) => r.refunded);
  const result: PaymentStats = {
    count: rows.length,
    byStatus,
    collected,
    pending: total(pending, (r) => r.amount),
    pendingCount: pending.length,
    fees,
    refunds,
    net: round2(collected - fees - refunds),
    unsettled: total(unsettled, (r) => r.net),
    unsettledCount: unsettled.length,
    overdueCount: unsettled.filter((r) => isSettlementOverdue(r, today)).length,
  };
  return ok(result);
}

function get({ params, req }: MockContext) {
  return ok(findPayment(params['id'], req.url));
}

function confirm({ params, req, userId }: MockContext) {
  return ok(confirmPayment(params['id'], bodyOf<ConfirmPaymentPayload>(req.body), actorName(userId), req.url));
}

function markFailed({ params, req, userId }: MockContext) {
  return ok(failPayment(params['id'], bodyOf<FailPaymentPayload>(req.body).reason, actorName(userId), req.url));
}

function retry({ params, req, userId }: MockContext) {
  return ok(retryPayment(params['id'], actorName(userId), req.url));
}

function refund({ params, req, userId }: MockContext) {
  return ok(refundPayment(params['id'], bodyOf<RefundPaymentPayload>(req.body), actorName(userId), req.url));
}

function settle({ params, req, userId }: MockContext) {
  return ok(settlePayment(params['id'], bodyOf<SettlePaymentPayload>(req.body), actorName(userId), req.url));
}

const BY_ID = 'payments/:id';

export const PAYMENTS_MOCK_ROUTES: MockRoute[] = [
  // `stats` before `:id` so it isn't captured as an id.
  { method: 'GET', path: PAYMENTS_ENDPOINTS.stats, protected: true, handle: stats },
  { method: 'GET', path: PAYMENTS_ENDPOINTS.list, protected: true, handle: list },
  { method: 'GET', path: BY_ID, protected: true, handle: get },
  { method: 'POST', path: `${BY_ID}/confirm`, protected: true, handle: confirm },
  { method: 'POST', path: `${BY_ID}/fail`, protected: true, handle: markFailed },
  { method: 'POST', path: `${BY_ID}/retry`, protected: true, handle: retry },
  { method: 'POST', path: `${BY_ID}/refund`, protected: true, handle: refund },
  { method: 'POST', path: `${BY_ID}/settle`, protected: true, handle: settle },
];
