import { PagedResponse } from '../core/models/api-response.model';
import { matchesAll, tokenize } from '../shared/utils/arabic-search.util';

interface CollectionOptions<T> {
  /** Fields matched by `search` (Arabic-aware, every word must hit). */
  searchFields: ReadonlyArray<keyof T>;
  /** Query param → predicate. Applied only when the param is present. */
  filters?: Readonly<Record<string, (row: T, value: string) => boolean>>;
}

/**
 * Server-side list behaviour for mock collections: search → filter → sort →
 * paginate, driven by the same query params the real API will receive.
 */
export function queryCollection<T extends object>(
  rows: readonly T[],
  query: URLSearchParams,
  options: CollectionOptions<T>,
): PagedResponse<T> {
  const tokens = tokenize(query.get('search') ?? '');
  let result = rows.filter((row) =>
    matchesAll(options.searchFields.map((f) => String(row[f] ?? '')), tokens),
  );

  for (const [param, predicate] of Object.entries(options.filters ?? {})) {
    const value = query.get(param);
    if (value) result = result.filter((row) => predicate(row, value));
  }

  const sortBy = query.get('sortBy') as keyof T | null;
  if (sortBy) {
    const dir = query.get('sortDir') === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) => compare(a[sortBy], b[sortBy]) * dir);
  }

  const pageSize = clampInt(query.get('pageSize'), 10, 1, 100);
  const totalPages = Math.max(1, Math.ceil(result.length / pageSize));
  const pageIndex = clampInt(query.get('pageIndex'), 1, 1, totalPages);
  const start = (pageIndex - 1) * pageSize;

  return {
    pageIndex,
    pageSize,
    count: result.length,
    totalPages,
    data: result.slice(start, start + pageSize),
  };
}

const collator = new Intl.Collator('ar', { numeric: true, sensitivity: 'base' });

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return collator.compare(String(a ?? ''), String(b ?? ''));
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

/** Reads a JSON request body as `T` (mock handlers only). */
export function bodyOf<T>(body: unknown): T {
  return (body ?? {}) as T;
}
