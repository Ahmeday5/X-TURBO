/**
 * Estimated budget (الموازنة التقديرية): planned amounts per revenue / expense
 * leaf account per month, compared with actual GL postings.
 *
 * Amounts are on the account's natural side: revenue = credit − debit,
 * expense = debit − credit.
 */
export interface BudgetLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  type: 'revenue' | 'expense';
  /** 12 values, Jan → Dec. */
  planned: number[];
  /** 12 values, Jan → Dec (0 for future months). */
  actual: number[];
}

export interface Budget {
  year: number;
  /** `null` = whole company. */
  costCenterId: string | null;
  lines: BudgetLine[];
  /** ISO timestamp of the last save; null if never saved. */
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface BudgetPayload {
  costCenterId: string | null;
  lines: Array<{ accountId: string; planned: number[] }>;
}

export const MONTH_LABELS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

export const sumOf = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/** Months of `year` already (partly) elapsed: 12 for past years, 0 for future ones. */
export function elapsedMonths(year: number, now = new Date()): number {
  if (year < now.getFullYear()) return 12;
  if (year > now.getFullYear()) return 0;
  return now.getMonth() + 1;
}

/**
 * Variance in the "good" direction: revenue above plan or expense below plan
 * are positive.
 */
export function favourableVariance(type: BudgetLine['type'], planned: number, actual: number): number {
  return type === 'revenue' ? actual - planned : planned - actual;
}
