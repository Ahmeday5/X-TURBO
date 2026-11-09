import {
  canRefund,
  canRetry,
  canSettle,
  ConfirmPaymentPayload,
  Payment,
  PaymentSummary,
  refundable,
  RefundPaymentPayload,
  SettlePaymentPayload,
  StorePaymentMethod,
} from '../../features/payments/models/payment.model';
import { OrderRecord, ordersSnapshot } from '../handlers/orders.handlers';
import { fail } from '../mock-http';
import { DAY_MS, pick, seeded } from '../mock-utils';
import { docNumber, findOr404, requireText, round2, todayIso } from './db-utils';

/**
 * Online-store payments, derived from the online orders in orders.handlers.ts
 * (same order numbers, customers and totals). Seeded lazily and kept in sync
 * with the orders mock: a pending COD collection becomes paid once its order
 * is delivered, or failed once it is cancelled.
 */

interface PaymentsDb {
  payments: Payment[];
  seq: number;
  refundSeq: number;
}

const HISTORY_DAYS = 120;
/** Share of older online orders that get a payment row (keeps the list ~100 rows). */
const SAMPLE_RATE = 0.42;

const WALLETS = ['فودافون كاش', 'أورنج كاش', 'اتصالات كاش', 'WE Pay'];
const COURIERS = ['بوسطة', 'أرامكس', 'جي آند تي'];
const STAFF = ['أحمد حسن', 'منى سعيد', 'خالد عادل', 'ياسمين فتحي'];
const CARD_FAILURES = ['رصيد غير كافٍ', 'رفض البنك المُصدر للبطاقة', 'انتهت مهلة التحقق (3D Secure)', 'ألغى العميل عملية الدفع'];
const WALLET_FAILURES = ['رصيد المحفظة غير كافٍ', 'لم يؤكد العميل العملية برمز PIN', 'انتهت صلاحية طلب الدفع'];
const COD_FAILURES = ['العميل لم يرد على المندوب', 'العميل غير متواجد بالعنوان', 'طلب العميل تأجيل الاستلام'];
const PARTIAL_REASONS = ['مرتجع جزئي — صنف تالف', 'تعويض عن تأخير الشحن', 'فرق سعر بعد خصم لاحق', 'صنف ناقص من الشحنة'];

/** Days until the gateway / courier transfers the money to the store. */
const SETTLEMENT_LAG: Record<StorePaymentMethod, number> = { card: 2, wallet: 1, instapay: 0, fawry: 3, cod: 7 };
const BATCH_CODE: Record<StorePaymentMethod, string> = { card: 'CRD', wallet: 'WAL', instapay: 'IPN', fawry: 'FWR', cod: 'COD' };

let state: PaymentsDb | null = null;

function db(): PaymentsDb {
  state ??= seed();
  syncWithOrders(state);
  return state;
}

export function paymentRows(): readonly Payment[] {
  return db().payments;
}

export function toPaymentSummary({ refunds: _r, timeline: _t, ...p }: Payment): PaymentSummary {
  return p;
}

export function findPayment(id: string | undefined, url: string): Payment {
  return findOr404(paymentRows(), id, url, 'عملية الدفع');
}

// ── Fees / dates ──

export function feeFor(method: StorePaymentMethod, amount: number): number {
  switch (method) {
    case 'card':
      return round2(amount * 0.0275 + 3);
    case 'wallet':
      return round2(amount * 0.015);
    case 'instapay':
      return 0;
    case 'fawry':
      return round2(amount * 0.02 + 2.5);
    case 'cod':
      return round2(Math.max(5, amount * 0.01));
  }
}

function localIsoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function plusDaysIso(isoTs: string, days: number): string {
  return localIsoDate(new Date(isoTs).getTime() + days * DAY_MS);
}

function batchFor(method: StorePaymentMethod, date: string): string {
  return `STL-${BATCH_CODE[method]}-${date.replace(/-/g, '')}`;
}

function recompute(p: Payment): void {
  p.refunded = round2(p.refunded);
  p.net = round2(p.amount - p.fee - p.refunded);
}

function markCaptured(p: Payment, at: string): void {
  p.paidAt = at;
  p.settlementStatus = 'unsettled';
  p.expectedSettlementDate = plusDaysIso(at, SETTLEMENT_LAG[p.method]);
}

// ── Seed ──

function seed(): PaymentsDb {
  const rand = seeded(7319);
  const now = Date.now();
  const today = todayIso();
  const out: Payment[] = [];
  let seq = 0;
  let refundSeq = 0;

  const digits = (n: number) => String(Math.floor(rand() * 10 ** n)).padStart(n, '0');
  const iso = (ms: number) => new Date(Math.min(ms, now)).toISOString();
  const minutes = (m: number) => m * 60_000;

  const eligible = ordersSnapshot()
    .filter((o) => o.channel === 'online' && now - new Date(o.createdAt).getTime() < HISTORY_DAYS * DAY_MS)
    .slice()
    .reverse(); // oldest first → numbers grow with time

  const base = (o: OrderRecord, method: StorePaymentMethod, provider: string, reference: string, at: number, attempt: number): Payment => {
    const amount = o.total;
    const p: Payment = {
      id: `pay-${++seq}`,
      number: docNumber('PAY', seq),
      createdAt: iso(at),
      paidAt: null,
      orderId: o.id,
      orderNumber: o.number,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      city: o.city,
      method,
      provider,
      reference,
      cardLast4: method === 'card' ? digits(4) : null,
      attempt,
      amount,
      fee: 0,
      refunded: 0,
      net: 0,
      status: 'pending',
      failureReason: null,
      settlementStatus: null,
      expectedSettlementDate: null,
      settledAt: null,
      settlementBatch: null,
      refunds: [],
      timeline: [{ type: 'created', at: iso(at), by: method === 'cod' ? 'النظام' : 'العميل' }],
    };
    recompute(p);
    return p;
  };

  const capture = (p: Payment, atMs: number, by: string, note?: string) => {
    const at = iso(atMs);
    p.status = 'paid';
    p.fee = feeFor(p.method, p.amount);
    markCaptured(p, at);
    p.timeline.push({ type: 'paid', at, by, note, amount: p.amount });
    recompute(p);
  };

  const refund = (p: Payment, atMs: number, amount: number, reason: string) => {
    if (atMs > now) return;
    const at = iso(atMs);
    const by = pick(rand, STAFF);
    p.refunds.push({ id: `rf-${++refundSeq}`, at, amount, reason, by });
    p.refunded += amount;
    p.status = refundable(p) > 0 ? 'partially_refunded' : 'refunded';
    p.timeline.push({ type: 'refund', at, by, note: reason, amount });
    recompute(p);
  };

  const failAt = (p: Payment, atMs: number, reason: string, by: string) => {
    p.status = 'failed';
    p.failureReason = reason;
    p.timeline.push({ type: 'failed', at: iso(atMs), by, note: reason });
  };

  const eventAt = (o: OrderRecord, status: string): number | null => {
    const e = o.timeline.find((t) => t.status === status);
    return e ? new Date(e.at).getTime() : null;
  };

  for (const o of eligible) {
    const placed = new Date(o.createdAt).getTime();
    const ageDays = (now - placed) / DAY_MS;
    if (ageDays >= 3 && rand() >= SAMPLE_RATE) continue;

    const r = rand();
    const method: StorePaymentMethod =
      o.paymentMethod === 'cash' ? 'cod' : o.paymentMethod === 'card' ? 'card' : r < 0.55 ? 'wallet' : r < 0.8 ? 'instapay' : 'fawry';

    if (method === 'cod') {
      const courier = pick(rand, COURIERS);
      const p = base(o, 'cod', courier, `AWB-${digits(9)}`, placed + minutes(1), 1);
      const delivered = eventAt(o, 'delivered');
      const cancelled = eventAt(o, 'cancelled');
      if (o.status === 'delivered' && delivered) {
        if (rand() < 0.12) {
          const firstTry = delivered - (1 + rand()) * DAY_MS;
          failAt(p, Math.max(firstTry, placed + minutes(30)), pick(rand, COD_FAILURES), `مندوب ${courier}`);
          p.attempt = 2;
          p.failureReason = null;
          p.status = 'pending';
          p.timeline.push({ type: 'retry', at: iso(Math.max(firstTry, placed) + 3_600_000), by: pick(rand, STAFF) });
        }
        capture(p, delivered, `مندوب ${courier}`, 'تم التحصيل نقدًا عند التسليم');
      } else if (o.status === 'cancelled' && cancelled) {
        failAt(p, cancelled, 'أُلغي الطلب قبل التحصيل', 'النظام');
      }
      out.push(p);
      continue;
    }

    const provider = method === 'card' ? 'Paymob' : method === 'wallet' ? pick(rand, WALLETS) : method === 'instapay' ? 'إنستاباي' : 'فوري';
    const ref = () =>
      method === 'card' ? `PMB-${digits(9)}` : method === 'wallet' ? `WLT-${digits(10)}` : method === 'instapay' ? `IPN-${digits(12)}` : `${digits(9)}`;

    // An earlier failed attempt on the same order.
    if ((method === 'card' || method === 'wallet') && rand() < 0.1) {
      const failed = base(o, method, provider, ref(), placed - minutes(4 + rand() * 6), 1);
      failAt(failed, new Date(failed.createdAt).getTime() + minutes(1), pick(rand, method === 'card' ? CARD_FAILURES : WALLET_FAILURES), 'بوابة الدفع');
      out.push(failed);
    }

    const attempt = out.some((x) => x.orderId === o.id) ? 2 : 1;
    const p = base(o, method, provider, ref(), placed - minutes(1 + rand() * 2), attempt);

    if (method === 'fawry') {
      // Customer pays the Fawry code at an outlet some hours later.
      const paidAt = placed + (2 + rand() * 20) * 3_600_000;
      if (o.status === 'pending' && paidAt > now) {
        out.push(p);
        continue;
      }
      capture(p, paidAt, 'فوري', 'تم السداد بكود فوري');
    } else {
      capture(p, placed, 'بوابة الدفع');
    }

    const cancelled = eventAt(o, 'cancelled');
    const delivered = eventAt(o, 'delivered');
    if (o.status === 'cancelled' && cancelled) {
      refund(p, Math.max(cancelled, new Date(p.paidAt!).getTime() + minutes(5)), p.amount, 'إلغاء الطلب');
    } else if (o.status === 'delivered' && delivered && rand() < 0.08) {
      const part = Math.max(50, Math.round((o.total * (0.1 + rand() * 0.25)) / 5) * 5);
      refund(p, delivered + (1 + rand() * 5) * DAY_MS, Math.min(part, o.total), pick(rand, PARTIAL_REASONS));
    }
    out.push(p);
  }

  // Settlement batches: due ones mostly settled, a few left behind for reconciliation.
  for (const p of out) {
    if (p.settlementStatus !== 'unsettled' || !p.expectedSettlementDate) continue;
    if (p.expectedSettlementDate > today) continue;
    if (p.expectedSettlementDate >= localIsoDate(now - 10 * DAY_MS) && rand() < 0.18) continue;
    const at = iso(new Date(`${p.expectedSettlementDate}T11:00:00`).getTime());
    p.settlementStatus = 'settled';
    p.settledAt = at;
    p.settlementBatch = batchFor(p.method, p.expectedSettlementDate);
    p.timeline.push({ type: 'settled', at, by: p.method === 'cod' ? p.provider : 'بوابة الدفع', note: p.settlementBatch, amount: p.net });
  }

  for (const p of out) p.timeline.sort((a, b) => a.at.localeCompare(b.at));
  return { payments: out, seq, refundSeq };
}

/** Pending COD collections follow their order: delivered → collected, cancelled → failed. */
function syncWithOrders(s: PaymentsDb): void {
  const orders = ordersSnapshot();
  for (const p of s.payments) {
    if (p.status !== 'pending' || p.method !== 'cod') continue;
    const o = orders.find((x) => x.id === p.orderId);
    if (!o) continue;
    if (o.status === 'delivered') {
      const at = o.timeline.find((t) => t.status === 'delivered')?.at ?? new Date().toISOString();
      p.status = 'paid';
      p.fee = feeFor(p.method, p.amount);
      markCaptured(p, at);
      p.timeline.push({ type: 'paid', at, by: `مندوب ${p.provider}`, note: 'تم التحصيل نقدًا عند التسليم', amount: p.amount });
      recompute(p);
    } else if (o.status === 'cancelled') {
      const at = o.timeline.find((t) => t.status === 'cancelled')?.at ?? new Date().toISOString();
      p.status = 'failed';
      p.failureReason = 'أُلغي الطلب قبل التحصيل';
      p.timeline.push({ type: 'failed', at, by: 'النظام', note: p.failureReason });
    }
  }
}

function orderOf(p: Payment): OrderRecord | undefined {
  return ordersSnapshot().find((o) => o.id === p.orderId);
}

// ── Actions ──

export function confirmPayment(id: string, payload: ConfirmPaymentPayload, by: string, url: string): Payment {
  const p = findPayment(id, url);
  if (p.status !== 'pending') throw fail(409, 'لا يمكن تأكيد تحصيل عملية غير معلّقة', url);
  const order = orderOf(p);
  if (order?.status === 'cancelled') throw fail(409, 'الطلب المرتبط ملغي — لا يمكن تأكيد التحصيل', url);

  const at = new Date().toISOString();
  const reference = payload.reference?.trim();
  if (reference) p.reference = reference;
  p.status = 'paid';
  p.failureReason = null;
  p.fee = feeFor(p.method, p.amount);
  markCaptured(p, at);
  p.timeline.push({
    type: 'paid',
    at,
    by,
    amount: p.amount,
    note: payload.note?.trim() || (p.method === 'cod' ? 'تأكيد استلام النقدية من المندوب' : 'تأكيد السداد يدويًا'),
  });
  recompute(p);
  if (order) order.paymentStatus = 'paid';
  return p;
}

export function failPayment(id: string, reason: unknown, by: string, url: string): Payment {
  const p = findPayment(id, url);
  if (p.status !== 'pending') throw fail(409, 'لا يمكن تسجيل فشل لعملية غير معلّقة', url);
  const text = requireText(reason, 'سبب الفشل مطلوب', url);
  p.status = 'failed';
  p.failureReason = text;
  p.timeline.push({ type: 'failed', at: new Date().toISOString(), by, note: text });
  return p;
}

export function retryPayment(id: string, by: string, url: string): Payment {
  const p = findPayment(id, url);
  if (!canRetry(p)) throw fail(409, 'إعادة المحاولة متاحة لعمليات التحصيل عند الاستلام الفاشلة فقط', url);
  if (orderOf(p)?.status === 'cancelled') throw fail(409, 'الطلب المرتبط ملغي — لا يمكن إعادة محاولة التحصيل', url);
  p.status = 'pending';
  p.failureReason = null;
  p.attempt += 1;
  p.timeline.push({ type: 'retry', at: new Date().toISOString(), by, note: `المحاولة رقم ${p.attempt}` });
  return p;
}

export function refundPayment(id: string, payload: RefundPaymentPayload, by: string, url: string): Payment {
  const s = db();
  const p = findPayment(id, url);
  if (!canRefund(p)) throw fail(409, 'لا يمكن استرداد هذه العملية', url);
  const reason = requireText(payload.reason, 'سبب الاسترداد مطلوب', url);
  const amount = round2(Number(payload.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw fail(422, 'مبلغ الاسترداد غير صالح', url);
  if (amount > refundable(p)) throw fail(422, 'مبلغ الاسترداد أكبر من المتاح للاسترداد', url);

  const at = new Date().toISOString();
  p.refunds.push({ id: `rf-${++s.refundSeq}`, at, amount, reason, by });
  p.refunded += amount;
  p.status = refundable(p) > 0 ? 'partially_refunded' : 'refunded';
  p.timeline.push({ type: 'refund', at, by, note: reason, amount });
  recompute(p);
  const order = orderOf(p);
  if (order && p.status === 'refunded') order.paymentStatus = 'refunded';
  return p;
}

export function settlePayment(id: string, payload: SettlePaymentPayload, by: string, url: string): Payment {
  const p = findPayment(id, url);
  if (!canSettle(p)) throw fail(409, 'العملية غير قابلة للتسوية', url);
  const at = new Date().toISOString();
  p.settlementStatus = 'settled';
  p.settledAt = at;
  p.settlementBatch = payload.batch?.trim() || batchFor(p.method, todayIso());
  p.timeline.push({ type: 'settled', at, by, note: p.settlementBatch, amount: p.net });
  return p;
}

