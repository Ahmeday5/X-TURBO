import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';

/** Everything a mock handler may use — passed in so handlers stay pure functions. */
export interface MockContext {
  req: HttpRequest<unknown>;
  /** Id of the user proven by the Bearer token (protected routes only). */
  userId: string | null;
  /** Values of `:param` segments in the matched route path. */
  params: Readonly<Record<string, string>>;
  /** Parsed query string. */
  query: URLSearchParams;
}

export type MockHandler = (ctx: MockContext) => HttpResponse<unknown>;

export interface MockRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path relative to `environment.apiUrl`, no leading slash; `:name` segments are params. */
  path: string;
  /** Require a valid Bearer access token (mirrors the real API). */
  protected: boolean;
  handle: MockHandler;
}

/** Wraps `data` in the standard `{ success, data }` envelope. */
export function ok<T>(data: T, status = 200): HttpResponse<unknown> {
  return new HttpResponse({ status, body: { success: true, data } });
}

/** Builds the error the real API would return; thrown by handlers. */
export function fail(status: number, message: string, url: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    statusText: message,
    url,
    error: { success: false, message },
  });
}

/** Realistic network jitter so loaders, skeletons and spinners are exercised. */
export function latencyMs(): number {
  return 280 + Math.round(Math.random() * 420);
}
