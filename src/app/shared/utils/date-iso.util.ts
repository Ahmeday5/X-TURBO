import { environment } from '../../../environments/environment';

/**
 * Calendar-date (`YYYY-MM-DD`) helpers — the single place the app computes
 * "today", "N days ago", "first of the month", default due dates, etc.
 *
 * Why not `new Date().toISOString().slice(0, 10)`: that is the UTC day, which
 * is still "yesterday" in Cairo until 02:00/03:00. The API buckets every
 * period in Cairo time (`environment.timeZone`), so "today" must be Cairo's
 * today whatever time zone the viewer's device is set to.
 *
 * Arithmetic is done on the date string itself (via UTC midnight), so it never
 * depends on the device time zone or DST either.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** en-CA formats as YYYY-MM-DD. */
const businessDay = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: environment.timeZone,
});

const atUtcMidnight = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const fromUtc = (d: Date): string => d.toISOString().slice(0, 10);

/** Today's calendar day in Cairo. */
export function todayIsoDate(now: Date = new Date()): string {
  return businessDay.format(now);
}

/** `iso` shifted by `days` (negative = past). */
export function addDaysIso(iso: string, days: number): string {
  const d = atUtcMidnight(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** `iso` shifted by `months`, clamped to the target month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonthsIso(iso: string, months: number): string {
  const d = atUtcMidnight(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return fromUtc(d);
}

export const startOfMonthIso = (iso: string): string => `${iso.slice(0, 7)}-01`;
export const startOfYearIso = (iso: string): string => `${iso.slice(0, 4)}-01-01`;

/** Cairo today + `days` — e.g. a quotation valid for 14 days. */
export const plusDaysIsoDate = (days: number): string => addDaysIso(todayIsoDate(), days);

/** Cairo today + `months` — e.g. a purchase invoice due next month. */
export const plusMonthsIsoDate = (months: number): string => addMonthsIso(todayIsoDate(), months);

/**
 * Calendar components of a `Date` the UI built locally (e.g. `new Date(y, m, d)`
 * from a picker). For "now", use `todayIsoDate()` instead.
 */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isValidIsoDate(value: string | null | undefined): boolean {
  if (!value || !ISO_DATE.test(value)) return false;
  return fromUtc(atUtcMidnight(value)) === value; // rejects 2026-02-30
}
