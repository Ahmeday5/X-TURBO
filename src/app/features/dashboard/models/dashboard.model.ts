/**
 * Wire contract of `GET dashboard/overview?range=…`.
 * Adjust to the real backend; UI labels/icons are owned by the components,
 * not by this payload.
 */

export type DashboardRange = '7d' | '30d' | '90d';

export interface KpiValue {
  value: number;
  /** % change vs the previous period of equal length (e.g. 12.4 = +12.4%). */
  deltaPct: number;
  /** Oldest → newest, one value per bucket of the selected range. */
  trend: number[];
}

export interface DashboardKpis {
  orders: KpiValue;
  avgOrderValue: KpiValue;
  inventoryValue: KpiValue;
  lowStockSkus: KpiValue;
}

export interface RevenuePoint {
  /** ISO date of the bucket start (day for 7d/30d, week for 90d). */
  date: string;
  revenue: number;
  orders: number;
}

export interface ChannelSales {
  channel: string;
  revenue: number;
  orders: number;
}

export interface WarehouseStatus {
  id: string;
  name: string;
  city: string;
  /** 0–100. */
  capacityPct: number;
  skuCount: number;
  lowStockCount: number;
}

export interface LowStockItem {
  sku: string;
  name: string;
  warehouse: string;
  quantity: number;
  reorderLevel: number;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface RecentOrder {
  id: string;
  customer: string;
  channel: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  /** ISO timestamp. */
  createdAt: string;
}

export interface TopProduct {
  sku: string;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
}

export interface DashboardOverview {
  range: DashboardRange;
  generatedAt: string;
  revenue: {
    total: number;
    deltaPct: number;
    series: RevenuePoint[];
  };
  kpis: DashboardKpis;
  channels: ChannelSales[];
  warehouses: WarehouseStatus[];
  lowStock: LowStockItem[];
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
}
