/**
 * Standard envelope returned by the backend for every successful response.
 * Backend may return data either at the root or under `data` — `ApiService`
 * normalizes both shapes into `<T>`.
 */
export interface ApiResponse<T = unknown> {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: ApiFieldErrors;
  statusCode?: number;
  timestamp?: string;
}

/** Backend validation errors keyed by field name. */
export type ApiFieldErrors = Record<string, string[] | string>;

/** Normalized error surfaced to the rest of the app. */
export interface ApiError {
  status: number;
  /** Stable machine-readable code (`ITEM_HAS_MOVEMENTS`, …) — branch on this, never on `message`. */
  code?: string;
  /** User-facing (Arabic) message, as sent by the server when available. */
  message: string;
  /** 422 only — camelCase keys, nested paths like `lines[0].qty`. */
  fieldErrors?: ApiFieldErrors;
  /** Server correlation id (body `traceId` or `X-Correlation-Id` header) — quote it in bug reports. */
  traceId?: string;
  /** Seconds from the `Retry-After` header on 429 responses, when exposed. */
  retryAfterSec?: number;
  raw?: unknown;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
}

/**
 * Server-paginated list shape for backends that return an index-based paged
 * envelope directly in `data`, e.g. `{ pageIndex, pageSize, count, totalPages, data }`.
 * Distinct from `PaginatedResponse<T>` above — adjust field names to match
 * your backend's actual convention.
 */
export interface PagedResponse<T> {
  pageIndex: number;
  pageSize: number;
  count: number;
  totalPages: number;
  data: T[];
}

export interface PagedQuery {
  pageIndex?: number;
  pageSize?: number;
  search?: string;
}
