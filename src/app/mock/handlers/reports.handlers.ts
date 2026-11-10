import { ORDER_CHANNELS, ORDER_STATUSES, PAYMENT_METHODS } from '../../features/orders/models/order.model';
import {
  CategorySales,
  DEFAULT_REPORT_RANGE,
  isReportRange,
  ProductReportRow,
  ReportGranularity,
  ReportRange,
  ReportsOverview,
} from '../../features/reports/models/report.model';
import { queryCollection } from '../mock-collection';
import { MockContext, MockRoute, ok } from '../mock-http';
import { DAY_MS, kpi, startOfDay, sum } from '../mock-utils';
import { itemsSnapshot } from './items.handlers';
import { OrderRecord, ordersSnapshot } from './orders.handlers';
import { API_ENDPOINTS } from '../../core/constants/api-endpoints.const';

/** Reports aggregated live from the orders mock — every figure reconciles with the orders page. */

interface Bucket {
  start: number;
  end: number;
}

interface Window {
  granularity: ReportGranularity;
  buckets: Bucket[];
  start: number;
  end: number;
}

function windowFor(range: ReportRange): Window {
  const today = startOfDay(new Date());
  let buckets: Bucket[];
  let granularity: ReportGranularity;

  if (range === '12m') {
    granularity = 'month';
    buckets = Array.from({ length: 12 }, (_, i) => {
      const start = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1).getTime();
      const end = new Date(today.getFullYear(), today.getMonth() - 10 + i, 1).getTime();
      return { start, end };
    });
  } else {
    const [count, size] = range === '90d' ? [13, 7] : [range === '7d' ? 7 : 30, 1];
    granularity = size === 1 ? 'day' : 'week';
    const endOfToday = today.getTime() + DAY_MS;
    buckets = Array.from({ length: count }, (_, i) => {
      const end = endOfToday - (count - 1 - i) * size * DAY_MS;
      return { start: end - size * DAY_MS, end };
    });
  }
  return { granularity, buckets, start: buckets[0].start, end: buckets[buckets.length - 1].end };
}

function inRange(rows: readonly OrderRecord[], start: number, end: number): OrderRecord[] {
  return rows.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= start && t < end;
  });
}

const billable = (rows: readonly OrderRecord[]) => rows.filter((o) => o.status !== 'cancelled');
const revenueOf = (rows: readonly OrderRecord[]) => sum(rows.map((o) => o.total));
const profitOf = (rows: readonly OrderRecord[]) =>
  sum(rows.map((o) => sum(o.lines.map((l, i) => (l.unitPrice - o.lineCosts[i]) * l.qty)) - o.discount));
const aov = (rows: readonly OrderRecord[]) => (rows.length ? Math.round(revenueOf(rows) / rows.length) : 0);

function rangeOf(query: URLSearchParams): ReportRange {
  const raw = query.get('range') ?? '';
  return isReportRange(raw) ? raw : DEFAULT_REPORT_RANGE;
}

function overview({ query }: MockContext) {
  const range = rangeOf(query);
  const win = windowFor(range);
  const all = ordersSnapshot();
  const current = inRange(all, win.start, win.end);
  const previous = inRange(all, win.start - (win.end - win.start), win.start);
  const cur = billable(current);
  const prev = billable(previous);

  const perBucket = win.buckets.map((b) => billable(inRange(current, b.start, b.end)));
  const items = new Map(itemsSnapshot().map((i) => [i.id, i]));

  const categories = new Map<string, CategorySales>();
  for (const o of cur) {
    for (const l of o.lines) {
      const item = items.get(l.itemId);
      if (!item) continue;
      const row = categories.get(item.groupId) ?? { groupId: item.groupId, name: item.groupName, color: item.groupColor, revenue: 0, units: 0 };
      row.revenue += l.total;
      row.units += l.qty;
      categories.set(item.groupId, row);
    }
  }

  const report: ReportsOverview = {
    range,
    granularity: win.granularity,
    generatedAt: new Date().toISOString(),
    kpis: {
      revenue: kpi(revenueOf(cur), revenueOf(prev), perBucket.map(revenueOf)),
      orders: kpi(cur.length, prev.length, perBucket.map((b) => b.length)),
      avgOrderValue: kpi(aov(cur), aov(prev), perBucket.map(aov)),
      grossProfit: kpi(profitOf(cur), profitOf(prev), perBucket.map(profitOf)),
    },
    series: win.buckets.map((b, i) => ({
      date: new Date(b.start).toISOString(),
      revenue: revenueOf(perBucket[i]),
      orders: perBucket[i].length,
    })),
    categories: [...categories.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    channels: ORDER_CHANNELS.map((channel) => {
      const rows = cur.filter((o) => o.channel === channel);
      return { channel, revenue: revenueOf(rows), orders: rows.length };
    }).sort((a, b) => b.revenue - a.revenue),
    payments: PAYMENT_METHODS.map((method) => {
      const rows = cur.filter((o) => o.paymentMethod === method);
      return { method, amount: revenueOf(rows), orders: rows.length };
    }),
    statuses: ORDER_STATUSES.map((status) => ({ status, orders: current.filter((o) => o.status === status).length })),
  };
  return ok(report);
}

function products({ query }: MockContext) {
  const win = windowFor(rangeOf(query));
  const cur = billable(inRange(ordersSnapshot(), win.start, win.end));
  const items = new Map(itemsSnapshot().map((i) => [i.id, i]));
  const total = revenueOf(cur) || 1;

  const rows = new Map<string, ProductReportRow>();
  for (const o of cur) {
    o.lines.forEach((l, i) => {
      const item = items.get(l.itemId);
      if (!item) return;
      const row = rows.get(item.id) ?? {
        id: item.id,
        code: item.code,
        name: item.name,
        groupId: item.groupId,
        groupName: item.groupName,
        groupColor: item.groupColor,
        unitsSold: 0,
        orders: 0,
        revenue: 0,
        profit: 0,
        marginPct: 0,
        sharePct: 0,
      };
      row.unitsSold += l.qty;
      row.orders += 1;
      row.revenue += l.total;
      row.profit += (l.unitPrice - o.lineCosts[i]) * l.qty;
      rows.set(item.id, row);
    });
  }

  const data = [...rows.values()].map((r) => ({
    ...r,
    marginPct: r.revenue ? Math.round((r.profit / r.revenue) * 1000) / 10 : 0,
    sharePct: Math.round((r.revenue / total) * 10000) / 100,
  }));

  return ok(
    queryCollection(data, query, {
      searchFields: ['name', 'code', 'groupName'],
      filters: { groupId: (row, v) => row.groupId === v },
    }),
  );
}

export const REPORTS_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: API_ENDPOINTS.reports.overview, protected: true, handle: overview },
  { method: 'GET', path: API_ENDPOINTS.reports.products, protected: true, handle: products },
];
