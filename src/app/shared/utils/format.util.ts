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
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const month = new Intl.DateTimeFormat(LOCALE, { month: 'short', year: '2-digit' });
const dateTime = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const longDate = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

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
export const formatDayMonth = (iso: string): string => dayMonth.format(new Date(iso));

/** نوفمبر 26 */
export const formatMonth = (iso: string): string => month.format(new Date(iso));

/** 4 نوفمبر 2026، 3:15 م */
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

/** 12.5% */
export const formatPercent = (pct: number): string => `${Math.round(pct * 10) / 10}%`;

/** الأربعاء، 4 نوفمبر 2026 */
export const formatLongDate = (date: Date): string => longDate.format(date);

/** "منذ 5 دقائق"، "أمس"… */
export function formatRelative(iso: string, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return relative.format(diffSec, 'second');
  if (abs < 3600) return relative.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(diffSec / 3600), 'hour');
  return relative.format(Math.round(diffSec / 86_400), 'day');
}
