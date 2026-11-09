import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { of, throwError, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AUTH_MOCK_ROUTES } from './handlers/auth.handlers';
import { DASHBOARD_MOCK_ROUTES } from './handlers/dashboard.handlers';
import { ITEMS_MOCK_ROUTES } from './handlers/items.handlers';
import { ORDERS_MOCK_ROUTES } from './handlers/orders.handlers';
import { REPORTS_MOCK_ROUTES } from './handlers/reports.handlers';
import { fail, latencyMs, MockRoute } from './mock-http';
import { verifyAccessToken } from './mock-tokens';

const ROUTES: readonly MockRoute[] = [
  ...AUTH_MOCK_ROUTES,
  ...DASHBOARD_MOCK_ROUTES,
  ...ITEMS_MOCK_ROUTES,
  ...ORDERS_MOCK_ROUTES,
  ...REPORTS_MOCK_ROUTES,
];

/** Matches `items/:id` against `items/42` → `{ id: '42' }`; `null` when it doesn't match. */
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/');
  const b = path.split('/');
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
const API_BASE = environment.apiUrl.replace(/\/+$/, '');

/**
 * In-browser fake backend for development (`environment.mockApi`).
 *
 * Registered as the INNERMOST interceptor, so every real interceptor (auth
 * header, 401 → refresh, loader, error toasts, cache) runs exactly as it will
 * against the real API. Requests outside `apiUrl` pass through untouched;
 * unknown API paths answer 404 so missing mocks are obvious.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE)) return next(req);

  const path = req.url.slice(API_BASE.length).replace(/^\/+/, '').split('?')[0];
  let params: Record<string, string> = {};
  const route = ROUTES.find((r) => {
    if (r.method !== req.method) return false;
    const match = matchPath(r.path, path);
    if (match) params = match;
    return !!match;
  });

  return timer(latencyMs()).pipe(
    switchMap(() => {
      if (!route) return throwError(() => fail(404, `Mock API: no handler for ${req.method} ${path}`, req.url));

      const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null;
      const userId = verifyAccessToken(bearer);
      if (route.protected && !userId) return throwError(() => fail(401, 'غير مصرح', req.url));

      try {
        return of(route.handle({ req, userId, params, query: new URL(req.urlWithParams, 'http://mock').searchParams }));
      } catch (err) {
        return throwError(() =>
          err instanceof HttpErrorResponse ? err : fail(500, 'Mock API handler crashed', req.url),
        );
      }
    }),
  );
};
