import {
  canCancelOrder,
  nextOrderStatus,
  Order,
  OrderChannel,
  OrderEvent,
  OrderLine,
  OrderPeriod,
  OrderStats,
  OrderStatus,
  OrderStatusChange,
  OrderSummary,
  ORDER_FLOW,
  ORDER_STATUSES,
  PaymentMethod,
  PaymentStatus,
} from '../../features/orders/models/order.model';
import { bodyOf, CollectionOptions, filterCollection, queryCollection } from '../mock-collection';
import { fail, MockContext, MockRoute, ok } from '../mock-http';
import { DAY_MS, pick, seeded, startOfDay, sum } from '../mock-utils';
import { DEMO_USERS } from '../mock-users';
import { itemsSnapshot } from './items.handlers';
import { API_ENDPOINTS } from '../../core/constants/api-endpoints.const';

/**
 * In-memory orders "database": ~13 months of seeded history built from the
 * items catalogue, so orders, reports and items all tell the same story.
 */

/** Internal row: the wire `Order` plus each line's unit cost (for profit reports). */
export interface OrderRecord extends Order {
  lineCosts: number[];
}

const HISTORY_DAYS = 400;

const CUSTOMERS: ReadonlyArray<[name: string, city: string]> = [
  ['كريم مصطفى', 'القاهرة'], ['نور الدين للسيارات', 'الجيزة'], ['سارة إبراهيم', 'الإسكندرية'],
  ['دلتا موتورز', 'طنطا'], ['يوسف علي', 'المنصورة'], ['مركز هاني للصيانة', 'القاهرة'],
  ['محمود عبد الله', 'الزقازيق'], ['منة الله سمير', 'القاهرة'], ['الأمل لقطع الغيار', 'أسيوط'],
  ['عمر خالد', 'الإسكندرية'], ['شركة النيل للنقل', 'بني سويف'], ['ريم أشرف', 'الجيزة'],
  ['مصطفى حسين', 'الإسماعيلية'], ['أوتو سيرفيس بلس', 'القاهرة'], ['هبة جمال', 'دمياط'],
  ['إسلام رجب', 'السويس'], ['ورشة الحاج سيد', 'المنيا'], ['آية محمد', 'بورسعيد'],
  ['طارق فوزي', 'الفيوم'], ['جراج المهندسين', 'الجيزة'],
];
const STREETS = ['شارع التحرير', 'شارع الهرم', 'طريق الحرية', 'شارع عباس العقاد', 'شارع الجمهورية', 'شارع 26 يوليو'];
const STAFF = ['أحمد حسن', 'منى سعيد', 'خالد عادل', 'ياسمين فتحي'];

const orders: OrderRecord[] = buildOrders();

function buildOrders(): OrderRecord[] {
  const rand = seeded(1337);
  const catalogue = itemsSnapshot().filter((i) => i.isActive && i.salePrice > 0);
  const now = Date.now();
  const today = startOfDay(new Date()).getTime();
  const out: OrderRecord[] = [];

  for (let day = HISTORY_DAYS - 1; day >= 0; day--) {
    // Gentle growth over the year + quieter Fridays.
    const growth = 0.55 + (1 - day / HISTORY_DAYS) * 0.75;
    const dayStart = today - day * DAY_MS;
    const friday = new Date(dayStart).getDay() === 5 ? 0.6 : 1;
    const count = Math.round((2 + rand() * 4) * growth * friday);

    for (let k = 0; k < count; k++) {
      const at = dayStart + (8 + rand() * 13) * 3_600_000;
      if (at > now) continue;
      out.push(buildOrder(out.length + 1, at, now, catalogue, rand));
    }
  }
  return out.reverse(); // newest first
}

function buildOrder(
  n: number,
  at: number,
  now: number,
  catalogue: ReturnType<typeof itemsSnapshot>,
  rand: () => number,
): OrderRecord {
  const [customerName, city] = pick(rand, CUSTOMERS);
  const channel: OrderChannel = rand() < 0.5 ? 'online' : rand() < 0.7 ? 'pos' : 'wholesale';
  const paymentMethod = pickPayment(channel, rand);
  const status = statusForAge((now - at) / DAY_MS, rand);

  const lineCount = 1 + Math.floor(rand() * (channel === 'wholesale' ? 5 : 3));
  const lines: OrderLine[] = [];
  const lineCosts: number[] = [];
  for (let i = 0; i < lineCount; i++) {
    const item = pick(rand, catalogue);
    if (lines.some((l) => l.itemId === item.id)) continue;
    const qty = 1 + Math.floor(rand() * (channel === 'wholesale' ? 10 : 2));
    lines.push({ itemId: item.id, code: item.code, name: item.name, qty, unitPrice: item.salePrice, total: qty * item.salePrice });
    lineCosts.push(item.purchasePrice);
  }

  const subtotal = sum(lines.map((l) => l.total));
  const discount = channel === 'wholesale' ? Math.round((subtotal * 0.05) / 5) * 5 : rand() < 0.15 ? 50 : 0;
  const shipping = channel === 'online' ? 60 : 0;
  const createdAt = new Date(at).toISOString();

  return {
    id: `ord-${n}`,
    number: `ORD-${10000 + n}`,
    customerName,
    customerPhone: `01${pick(rand, ['0', '1', '2', '5'])}${String(Math.floor(rand() * 1e8)).padStart(8, '0')}`,
    city,
    address: `${Math.ceil(rand() * 120)} ${pick(rand, STREETS)}، ${city}`,
    channel,
    paymentMethod,
    paymentStatus: paymentStatusFor(status, paymentMethod, rand),
    status,
    itemCount: sum(lines.map((l) => l.qty)),
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    note: rand() < 0.12 ? 'برجاء الاتصال قبل التوصيل' : '',
    createdAt,
    lines,
    lineCosts,
    timeline: timelineFor(status, at, rand),
  };
}

function pickPayment(channel: OrderChannel, rand: () => number): PaymentMethod {
  if (channel === 'pos') return rand() < 0.6 ? 'cash' : 'card';
  if (channel === 'wholesale') return rand() < 0.6 ? 'credit' : 'cash';
  return pick(rand, ['card', 'wallet', 'cash'] as const);
}

function statusForAge(ageDays: number, rand: () => number): OrderStatus {
  const r = rand();
  if (ageDays < 1) return r < 0.45 ? 'pending' : r < 0.8 ? 'processing' : r < 0.95 ? 'shipped' : 'cancelled';
  if (ageDays < 4) return r < 0.1 ? 'pending' : r < 0.3 ? 'processing' : r < 0.6 ? 'shipped' : r < 0.93 ? 'delivered' : 'cancelled';
  return r < 0.91 ? 'delivered' : 'cancelled';
}

function paymentStatusFor(status: OrderStatus, method: PaymentMethod, rand: () => number): PaymentStatus {
  const prepaid = method === 'card' || method === 'wallet';
  if (status === 'cancelled') return prepaid ? 'refunded' : 'unpaid';
  if (status === 'delivered') return method === 'credit' && rand() < 0.4 ? 'unpaid' : 'paid';
  return prepaid ? 'paid' : 'unpaid';
}

function timelineFor(status: OrderStatus, at: number, rand: () => number): OrderEvent[] {
  const path: readonly OrderStatus[] =
    status === 'cancelled'
      ? rand() < 0.5 ? ['pending', 'cancelled'] : ['pending', 'processing', 'cancelled']
      : ORDER_FLOW.slice(0, ORDER_FLOW.indexOf(status) + 1);

  let t = at;
  return path.map((s, i) => {
    if (i) t = Math.min(Date.now(), t + (1 + rand() * 20) * 3_600_000);
    return {
      status: s,
      at: new Date(t).toISOString(),
      by: i ? pick(rand, STAFF) : 'العميل',
      note: s === 'cancelled' ? 'ألغي بناءً على طلب العميل' : undefined,
    };
  });
}

// ── Queries ──

const PERIOD_DAYS: Record<Exclude<OrderPeriod, 'today'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

function periodStart(period: string): number {
  const today = startOfDay(new Date()).getTime();
  return period === 'today' ? today : today - ((PERIOD_DAYS[period as keyof typeof PERIOD_DAYS] ?? 0) - 1) * DAY_MS;
}

const BASE_FILTERS: CollectionOptions<OrderRecord>['filters'] = {
  channel: (row, v) => row.channel === v,
  payment: (row, v) => row.paymentStatus === v,
  period: (row, v) => new Date(row.createdAt).getTime() >= periodStart(v),
};

const LIST_OPTIONS: CollectionOptions<OrderRecord> = {
  searchFields: ['number', 'customerName', 'customerPhone', 'city'],
  filters: { ...BASE_FILTERS, status: (row, v) => row.status === v },
};

function toSummary(o: OrderRecord): OrderSummary {
  const { id, number, customerName, customerPhone, city, channel, paymentMethod, paymentStatus, status, itemCount, total, createdAt } = o;
  return { id, number, customerName, customerPhone, city, channel, paymentMethod, paymentStatus, status, itemCount, total, createdAt };
}

function toOrder({ lineCosts: _costs, ...order }: OrderRecord): Order {
  return order;
}

function listOrders({ query }: MockContext) {
  const page = queryCollection(orders, query, LIST_OPTIONS);
  return ok({ ...page, data: page.data.map(toSummary) });
}

function orderStats({ query }: MockContext) {
  const rows = filterCollection(orders, query, { ...LIST_OPTIONS, filters: BASE_FILTERS });
  const billable = rows.filter((o) => o.status !== 'cancelled');
  const revenue = sum(billable.map((o) => o.total));
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  rows.forEach((o) => byStatus[o.status]++);

  const stats: OrderStats = {
    count: rows.length,
    revenue,
    avgValue: billable.length ? Math.round(revenue / billable.length) : 0,
    byStatus,
  };
  return ok(stats);
}

function getOrder({ params, req }: MockContext) {
  return ok(toOrder(findOrder(params['id'], req.url)));
}

function changeStatus({ params, req, userId }: MockContext) {
  const order = findOrder(params['id'], req.url);
  const { status, note } = bodyOf<OrderStatusChange>(req.body);
  const allowed = status === 'cancelled' ? canCancelOrder(order.status) : nextOrderStatus(order.status) === status;
  if (!allowed) throw fail(409, 'لا يمكن نقل الطلب إلى هذه الحالة', req.url);

  order.status = status;
  order.timeline.push({
    status,
    at: new Date().toISOString(),
    by: DEMO_USERS.find((u) => u.id === userId)?.name ?? 'النظام',
    note: note?.trim() || undefined,
  });
  if (status === 'delivered' && order.paymentMethod === 'cash') order.paymentStatus = 'paid';
  if (status === 'cancelled') order.paymentStatus = order.paymentStatus === 'paid' ? 'refunded' : 'unpaid';
  return ok(toOrder(order));
}

function findOrder(id: string | undefined, url: string): OrderRecord {
  const order = orders.find((o) => o.id === id);
  if (!order) throw fail(404, 'الطلب غير موجود', url);
  return order;
}

/** Read-only view for the reports mock. */
export function ordersSnapshot(): readonly OrderRecord[] {
  return orders;
}

export const ORDERS_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: API_ENDPOINTS.orders.list, protected: true, handle: listOrders },
  // `stats` before `:id` so it isn't captured as an id.
  { method: 'GET', path: API_ENDPOINTS.orders.stats, protected: true, handle: orderStats },
  { method: 'GET', path: 'orders/:id', protected: true, handle: getOrder },
  { method: 'PATCH', path: 'orders/:id/status', protected: true, handle: changeStatus },
];
