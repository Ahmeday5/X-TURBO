import { KpiValue } from '../shared/models/kpi.model';

/** Shared helpers for mock handlers — deterministic data and small maths. */

export const DAY_MS = 86_400_000;

/** mulberry32 — tiny deterministic PRNG, so seeded data is stable across reloads. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)];
}

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function pctChange(current: number, previous: number): number {
  return previous ? Math.round(((current - previous) / previous) * 1000) / 10 : 0;
}

export function kpi(value: number, previous: number, trend: number[]): KpiValue {
  return { value, deltaPct: pctChange(value, previous), trend };
}

/** Noisy walk from `from` to `to` — trend lines for stock-style KPIs. */
export function walk(length: number, from: number, to: number, rand: () => number): number[] {
  return Array.from({ length }, (_, i) => {
    const t = length === 1 ? 1 : i / (length - 1);
    const jitter = (rand() - 0.5) * Math.abs(to - from) * 0.6;
    return from + (to - from) * t + (i === length - 1 ? 0 : jitter);
  });
}
