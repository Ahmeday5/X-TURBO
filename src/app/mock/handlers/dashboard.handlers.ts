import {
  ChannelSales,
  DashboardOverview,
  DashboardRange,
  LowStockItem,
  OrderStatus,
  RecentOrder,
  RevenuePoint,
  TopProduct,
  WarehouseStatus,
} from '../../features/dashboard/models/dashboard.model';
import { MockContext, MockRoute, ok } from '../mock-http';
import { kpi, pctChange, seeded, startOfDay, sum, walk } from '../mock-utils';
import { API_ENDPOINTS } from '../../core/constants/api-endpoints.const';

/**
 * Deterministic, plausible numbers for an auto-parts retailer. Seeded per
 * range so the same filter always renders the same figures, while the
 * previous period uses a different seed to produce realistic deltas.
 */

const RANGES: Record<DashboardRange, { buckets: number; bucketDays: number; seed: number }> = {
  '7d': { buckets: 7, bucketDays: 1, seed: 7 },
  '30d': { buckets: 30, bucketDays: 1, seed: 30 },
  '90d': { buckets: 13, bucketDays: 7, seed: 90 },
};

const DAILY_REVENUE = 186_000;
const DAILY_ORDERS = 142;

const WAREHOUSES = [
  { id: 'wh-cai', name: 'المخزن الرئيسي', city: 'مدينة نصر، القاهرة' },
  { id: 'wh-alx', name: 'مخزن الإسكندرية', city: 'سموحة، الإسكندرية' },
  { id: 'wh-giz', name: 'مخزن الجيزة', city: 'الهرم، الجيزة' },
  { id: 'wh-oct', name: 'مخزن 6 أكتوبر', city: 'المنطقة الصناعية' },
];

const PARTS = [
  { sku: 'BRK-TY-1820', name: 'تيل فرامل — تويوتا كورولا 2018+', category: 'الفرامل', price: 1450 },
  { sku: 'FLT-HY-0441', name: 'فلتر زيت — هيونداي إلنترا', category: 'الفلاتر', price: 220 },
  { sku: 'IGN-NGK-4PK', name: 'بوجيهات NGK إيريديوم (طقم 4)', category: 'الإشعال', price: 1180 },
  { sku: 'FLT-KI-0912', name: 'فلتر هواء — كيا سيراتو', category: 'الفلاتر', price: 340 },
  { sku: 'ENG-NS-TB07', name: 'طقم سير كاتينة — نيسان صني', category: 'المحرك', price: 2650 },
  { sku: 'SUS-CH-F220', name: 'مساعد أمامي — شيفروليه لانوس', category: 'العفشة', price: 1890 },
  { sku: 'BAT-VR-70AH', name: 'بطارية فارتا 70 أمبير', category: 'الكهرباء', price: 4200 },
  { sku: 'OIL-MB-5W30', name: 'زيت موبيل 1 ‎5W-30 تخليقي (4 لتر)', category: 'الزيوت', price: 1750 },
];

const CUSTOMERS = ['كريم مصطفى', 'نور الدين للسيارات', 'سارة إبراهيم', 'دلتا موتورز', 'يوسف علي', 'مركز هاني للصيانة'];
const CHANNELS = ['المتجر الإلكتروني', 'نقاط البيع', 'الجملة'];
const STATUSES: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'delivered', 'cancelled'];

function overview({ req }: MockContext) {
  const range = (new URL(req.urlWithParams, 'http://mock').searchParams.get('range') ?? '30d') as DashboardRange;
  return ok(buildOverview(RANGES[range] ? range : '30d'));
}

function buildOverview(range: DashboardRange): DashboardOverview {
  const cfg = RANGES[range];
  const rand = seeded(cfg.seed);
  const prevRand = seeded(cfg.seed * 31);

  const series = buildSeries(cfg.buckets, cfg.bucketDays, rand);
  const previous = buildSeries(cfg.buckets, cfg.bucketDays, prevRand, 0.9);

  const revenue = sum(series.map((p) => p.revenue));
  const orders = sum(series.map((p) => p.orders));
  const prevRevenue = sum(previous.map((p) => p.revenue));
  const prevOrders = sum(previous.map((p) => p.orders));

  const lowStock = buildLowStock(rand);

  return {
    range,
    generatedAt: new Date().toISOString(),
    revenue: { total: revenue, deltaPct: pctChange(revenue, prevRevenue), series },
    kpis: {
      orders: kpi(orders, prevOrders, series.map((p) => p.orders)),
      avgOrderValue: kpi(
        Math.round(revenue / orders),
        Math.round(prevRevenue / prevOrders),
        series.map((p) => Math.round(p.revenue / p.orders)),
      ),
      inventoryValue: kpi(18_420_000, 17_960_000, walk(cfg.buckets, 17_960_000, 18_420_000, rand)),
      lowStockSkus: kpi(23, 19, walk(cfg.buckets, 19, 23, rand).map(Math.round)),
    },
    channels: buildChannels(revenue, orders),
    warehouses: buildWarehouses(rand),
    lowStock,
    recentOrders: buildRecentOrders(rand),
    topProducts: buildTopProducts(cfg.buckets * cfg.bucketDays, rand),
  };
}

function buildSeries(buckets: number, bucketDays: number, rand: () => number, scale = 1): RevenuePoint[] {
  const today = startOfDay(new Date());
  return Array.from({ length: buckets }, (_, i) => {
    const offsetDays = (buckets - 1 - i) * bucketDays;
    const date = new Date(today.getTime() - offsetDays * 86_400_000);
    const growth = 0.88 + (i / buckets) * 0.22; // gentle upward trend
    const weekly = bucketDays === 1 && date.getDay() === 5 ? 0.78 : 1; // quieter Fridays
    const noise = 0.86 + rand() * 0.28;
    const factor = growth * weekly * noise * scale * bucketDays;
    return {
      date: date.toISOString(),
      revenue: Math.round(DAILY_REVENUE * factor),
      orders: Math.round(DAILY_ORDERS * factor * (0.94 + rand() * 0.12)),
    };
  });
}

function buildChannels(revenue: number, orders: number): ChannelSales[] {
  const split = [0.52, 0.33, 0.15];
  return CHANNELS.map((channel, i) => ({
    channel,
    revenue: Math.round(revenue * split[i]),
    orders: Math.round(orders * split[i] * (i === 2 ? 0.35 : 1.1)),
  }));
}

function buildWarehouses(rand: () => number): WarehouseStatus[] {
  const capacity = [92, 78, 64, 48];
  return WAREHOUSES.map((w, i) => ({
    ...w,
    capacityPct: capacity[i],
    skuCount: Math.round(4200 - i * 820 + rand() * 300),
    lowStockCount: [9, 6, 5, 3][i],
  }));
}

function buildLowStock(rand: () => number): LowStockItem[] {
  return PARTS.slice(0, 6).map((p, i) => {
    const reorderLevel = [40, 120, 60, 80, 25, 30][i];
    return {
      sku: p.sku,
      name: p.name,
      warehouse: WAREHOUSES[i % WAREHOUSES.length].name,
      reorderLevel,
      quantity: Math.max(1, Math.round(reorderLevel * (0.08 + rand() * 0.7))),
    };
  });
}

function buildRecentOrders(rand: () => number): RecentOrder[] {
  const now = Date.now();
  return CUSTOMERS.map((customer, i) => ({
    id: `XT-${(48213 - i * 7).toString()}`,
    customer,
    channel: CHANNELS[i % CHANNELS.length],
    itemCount: 1 + Math.floor(rand() * 6),
    total: Math.round((800 + rand() * 14_000) / 10) * 10,
    status: STATUSES[i],
    createdAt: new Date(now - (i * 23 + 4) * 60_000).toISOString(),
  }));
}

function buildTopProducts(days: number, rand: () => number): TopProduct[] {
  return PARTS.map((p) => {
    const unitsSold = Math.round(days * (2 + rand() * 9) * (p.price < 1000 ? 2.2 : 1));
    return { sku: p.sku, name: p.name, category: p.category, unitsSold, revenue: unitsSold * p.price };
  })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

export const DASHBOARD_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: API_ENDPOINTS.dashboard.overview, protected: true, handle: overview },
];
