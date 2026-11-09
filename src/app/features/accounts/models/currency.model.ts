/** A currency and its rate against the base currency (EGP). */
export interface Currency {
  id: string;
  /** ISO-4217, e.g. `USD`. */
  code: string;
  name: string;
  symbol: string;
  /** EGP per 1 unit. Base currency = 1. */
  rate: number;
  previousRate: number;
  /** % change vs previous rate. */
  changePct: number;
  /** Recent rates, oldest first (last = current). */
  history: number[];
  isBase: boolean;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export type CurrencyPayload = Pick<Currency, 'code' | 'name' | 'symbol' | 'rate' | 'isActive'>;

export const BASE_CURRENCY = 'EGP';
