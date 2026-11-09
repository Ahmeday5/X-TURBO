/** A headline metric for a period, compared with the previous period of equal length. */
export interface KpiValue {
  value: number;
  /** % change vs the previous period (e.g. 12.4 = +12.4%). */
  deltaPct: number;
  /** Oldest → newest, one value per bucket of the selected range. */
  trend: number[];
}
