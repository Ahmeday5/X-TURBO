import { environment } from '../../../environments/environment';

/**
 * Number / date formatting for the Arabic UI. Formatters are created once and
 * reused — `Intl.*Format` construction is comparatively expensive.
 *
 * Locale: Egyptian Arabic with Latin digits (`nu-latn`) — Arabic month/day
 * names and currency, but 0-9 digits, which read faster in dense tables and
 * match what staff type into the system.
 */

const LOCALE = 'ar-EG-u-nu-latn';

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });
const money = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: environment.currency,
  maximumFractionDigits: 0,
});
const moneyCompact = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: environment.currency,
  notation: 'compact',
  maximumFractionDigits: 1,
});
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

/**
 * Dates follow the API contract:
 *   - timestamps are UTC ISO with `Z` → shown in the business time zone
 *     (Cairo), whatever time zone the viewer's device is set to;
 *   - date-only values (`YYYY-MM-DD`: report buckets, document dates) are
 *     already Cairo calendar days → shown as-is. `new Date('2026-11-03')` is
 *     UTC midnight, so they're formatted in UTC to never shift a day.
 */
const TIME_ZONE = environment.timeZone;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface ZonedFormat {
  zoned: Intl.DateTimeFormat;
  dateOnly: Intl.DateTimeFormat;
}

function zonedFormat(options: Intl.DateTimeFormatOptions): ZonedFormat {
  return {
    zoned: new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: TIME_ZONE }),
    dateOnly: new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: 'UTC' }),
  };
}

function formatIso(f: ZonedFormat, iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_ONLY.test(iso) ? f.dateOnly.format(date) : f.zoned.format(date);
}

const dayMonth = zonedFormat({ day: 'numeric', month: 'short' });
const month = zonedFormat({ month: 'short', year: '2-digit' });
const shortDate = zonedFormat({ day: 'numeric', month: 'short', year: 'numeric' });
const dateTime = zonedFormat({ day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fullDate = zonedFormat({ day: 'numeric', month: 'long', year: 'numeric' });
const longDate = zonedFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** 1,284 */
export const formatInteger = (value: number): string => integer.format(value);

/** 1,284 below 10k, "12.9 ألف" / "4.2 مليون" above. */
export const formatCompact = (value: number): string =>
  Math.abs(value) < 10_000 ? integer.format(value) : compact.format(value);

/** 12,450 ج.م. */
export const formatMoney = (value: number): string => money.format(value);

/** 12,450 ج.م. below 100k, "4.2 مليون ج.م." above. */
export const formatMoneyCompact = (value: number): string =>
  Math.abs(value) < 100_000 ? money.format(value) : moneyCompact.format(value);

/** +12.4% / −3.1% (true minus sign) — render inside an LTR-isolated span. */
export const formatDelta = (pct: number): string =>
  `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(1)}%`;

/** 4 نوفمبر */
export const formatDayMonth = (iso: string): string => formatIso(dayMonth, iso);

/** نوفمبر 26 */
export const formatMonth = (iso: string): string => formatIso(month, iso);

/** 4 نوفمبر 2026 */
export const formatShortDate = (iso: string): string => formatIso(shortDate, iso);

/** 4 نوفمبر 2026، 3:15 م — Cairo time. */
export const formatDateTime = (iso: string): string => formatIso(dateTime, iso);

const hourOnly = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TIME_ZONE });

/** Current hour (0–23) in Cairo — e.g. for a "good morning / evening" greeting. */
export const businessHour = (now: Date = new Date()): number => Number(hourOnly.format(now)) % 24;

/** 12.5% */
export const formatPercent = (pct: number): string => `${Math.round(pct * 10) / 10}%`;

/** 4 نوفمبر 2026 — printouts. */
export const formatFullDate = (iso: string): string => formatIso(fullDate, iso);

/** الأربعاء، 4 نوفمبر 2026 — accepts a `Date` (an instant) or an ISO string. */
export const formatLongDate = (value: Date | string): string =>
  typeof value === 'string' ? formatIso(longDate, value) : longDate.zoned.format(value);

/** "منذ 5 دقائق"، "أمس"… */
export function formatRelative(iso: string, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return relative.format(diffSec, 'second');
  if (abs < 3600) return relative.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(diffSec / 3600), 'hour');
  return relative.format(Math.round(diffSec / 86_400), 'day');
}
