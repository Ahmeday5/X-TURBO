import { KpiValue } from '../../../shared/models/kpi.model';
import { OrderChannel, OrderStatus, PaymentMethod } from '../../orders/models/order.model';

/** Wire contract of `GET reports/overview?range=…` and `GET reports/products`. */

export type ReportRange = '7d' | '30d' | '90d' | '12m';
export type ReportGranularity = 'day' | 'week' | 'month';

export interface ReportKpis {
  revenue: KpiValue;
  orders: KpiValue;
  avgOrderValue: KpiValue;
  grossProfit: KpiValue;
}

export interface ReportPoint {
  /** ISO date of the bucket start. */
  date: string;
  revenue: number;
  orders: number;
}

export interface CategorySales {
  groupId: string;
  name: string;
  color: string;
  revenue: number;
  units: number;
}

export interface ChannelReport {
  channel: OrderChannel;
  revenue: number;
  orders: number;
}

export interface PaymentReport {
  method: PaymentMethod;
  amount: number;
  orders: number;
}

export interface StatusReport {
  status: OrderStatus;
  orders: number;
}

export interface ReportsOverview {
  range: ReportRange;
  granularity: ReportGranularity;
  generatedAt: string;
  kpis: ReportKpis;
  series: ReportPoint[];
  categories: CategorySales[];
  channels: ChannelReport[];
  payments: PaymentReport[];
  statuses: StatusReport[];
}

/** One row of the product performance table. */
export interface ProductReportRow {
  id: string;
  code: string;
  name: string;
  groupId: string;
  groupName: string;
  groupColor: string;
  unitsSold: number;
  orders: number;
  revenue: number;
  profit: number;
  marginPct: number;
  /** Share of the period's revenue, 0–100. */
  sharePct: number;
}

export const REPORT_RANGES: ReadonlyArray<{ value: ReportRange; label: string; period: string }> = [
  { value: '7d', label: '7 أيام', period: 'آخر 7 أيام' },
  { value: '30d', label: '30 يومًا', period: 'آخر 30 يومًا' },
  { value: '90d', label: '90 يومًا', period: 'آخر 90 يومًا' },
  { value: '12m', label: '12 شهرًا', period: 'آخر 12 شهرًا' },
];

export const DEFAULT_REPORT_RANGE: ReportRange = '30d';

export function isReportRange(value: string): value is ReportRange {
  return REPORT_RANGES.some((r) => r.value === value);
}
