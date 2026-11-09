import { fail } from '../mock-http';
import { findUserById } from '../mock-users';
import { DAY_MS } from '../mock-utils';

/**
 * Helpers shared by the in-memory stores in `mock/db/`.
 *
 * Stores seed lazily (on first access) so modules can import each other
 * without caring about evaluation order.
 */

export function findOr404<T extends { id: string }>(rows: readonly T[], id: string | null | undefined, url: string, what = 'العنصر'): T {
  const row = id ? rows.find((r) => r.id === id) : undefined;
  if (!row) throw fail(404, `${what} غير موجود`, url);
  return row;
}

/** `PREFIX-000042`. */
export function docNumber(prefix: string, n: number, width = 6): string {
  return `${prefix}-${String(n).padStart(width, '0')}`;
}

/** Display name of the signed-in user (falls back for system-generated rows). */
export function actorName(userId: string | null): string {
  return (userId && findUserById(userId)?.name) || 'النظام';
}

/** Local ISO date `days` ago (YYYY-MM-DD). */
export function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * DAY_MS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayIso(): string {
  return isoDaysAgo(0);
}

/** Inclusive ISO-date range filter; empty bounds are open. */
export function inRange(date: string, from: string | null, to: string | null): boolean {
  const d = date.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function requireText(value: unknown, message: string, url: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw fail(422, message, url);
  return text;
}

export function nonNegative(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
