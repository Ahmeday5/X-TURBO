import { seeded } from '../mock-utils';

export interface CurrencyRecord {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  isActive: boolean;
  /** Oldest first; last = current rate. */
  history: number[];
  updatedAt: string;
  updatedBy: string;
}

const SEED: ReadonlyArray<[code: string, name: string, symbol: string, rate: number]> = [
  ['EGP', 'جنيه مصري', 'ج.م', 1],
  ['USD', 'دولار أمريكي', '$', 48.62],
  ['EUR', 'يورو', '€', 52.94],
  ['SAR', 'ريال سعودي', 'ر.س', 12.95],
  ['AED', 'درهم إماراتي', 'د.إ', 13.24],
  ['KWD', 'دينار كويتي', 'د.ك', 158.4],
  ['GBP', 'جنيه إسترليني', '£', 61.73],
  ['CNY', 'يوان صيني', '¥', 6.72],
  ['JPY', 'ين ياباني', '¥', 0.322],
];

const HISTORY = 30;

let state: CurrencyRecord[] | null = null;

export function currencyRows(): CurrencyRecord[] {
  return (state ??= seed());
}

function seed(): CurrencyRecord[] {
  const rand = seeded(8080);
  return SEED.map(([code, name, symbol, rate], i) => {
    const history: number[] = [];
    let r = rate * (0.96 + rand() * 0.03);
    for (let d = 0; d < HISTORY - 1; d++) {
      history.push(round4(r));
      r += (rate - r) * 0.12 + (rand() - 0.5) * rate * 0.008;
    }
    history.push(rate);
    return {
      id: `cur-${code.toLowerCase()}`,
      code,
      name,
      symbol,
      isBase: i === 0,
      isActive: code !== 'JPY',
      history: i === 0 ? Array(HISTORY).fill(1) : history,
      updatedAt: new Date(Date.now() - Math.floor(rand() * 3) * 86_400_000 - 3_600_000).toISOString(),
      updatedBy: 'أحمد حسن',
    };
  });
}

export const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;

export const HISTORY_LENGTH = HISTORY;
