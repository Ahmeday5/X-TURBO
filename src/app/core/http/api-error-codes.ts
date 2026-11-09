import { ApiError } from '../models/api-response.model';

/**
 * Stable error codes the backend sends in `{ success:false, code }`.
 * Only the cross-cutting ones live here — feature-specific business codes
 * (`ITEM_HAS_MOVEMENTS`, `DOCUMENT_NOT_DRAFT`, …) are declared next to the
 * feature that handles them. Full list: backend `docs/ERROR-CODES.md`.
 */
export const API_ERROR_CODES = {
  unauthorized: 'UNAUTHORIZED',
  sessionExpired: 'SESSION_EXPIRED',
  forbidden: 'FORBIDDEN',
  notFound: 'NOT_FOUND',
  routeNotFound: 'ROUTE_NOT_FOUND',
  concurrencyConflict: 'CONCURRENCY_CONFLICT',
  validation: 'VALIDATION_ERROR',
  loginLocked: 'LOGIN_LOCKED',
  rateLimited: 'RATE_LIMITED',
  internal: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/** True when `err` is an `ApiError` carrying one of the given codes. */
export function hasErrorCode(err: unknown, ...codes: readonly string[]): boolean {
  const code = (err as ApiError | null)?.code;
  return !!code && codes.includes(code);
}
