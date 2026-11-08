export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: string;
  dir: SortDir;
}

/**
 * Query every server-paginated list accepts. `pageIndex` is 1-based.
 * Feature filters travel in `filters` and are sent as plain query params.
 */
export interface ListQuery {
  pageIndex: number;
  pageSize: number;
  search: string;
  sort: SortState | null;
  filters: Readonly<Record<string, string>>;
}

/** Flattens a ListQuery into API query params (empty values are dropped by ApiService). */
export function toListParams(query: ListQuery): Record<string, unknown> {
  return {
    pageIndex: query.pageIndex,
    pageSize: query.pageSize,
    search: query.search,
    sortBy: query.sort?.key,
    sortDir: query.sort?.dir,
    ...query.filters,
  };
}
