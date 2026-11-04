import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { of, throwError, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AUTH_MOCK_ROUTES } from './handlers/auth.handlers';
import { DASHBOARD_MOCK_ROUTES } from './handlers/dashboard.handlers';
import { fail, latencyMs, MockRoute } from './mock-http';
import { verifyAccessToken } from './mock-tokens';

const ROUTES: readonly MockRoute[] = [...AUTH_MOCK_ROUTES, ...DASHBOARD_MOCK_ROUTES];
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

  const path = req.url.slice(API_BASE.length).replace(/^\/+/, '');
  const route = ROUTES.find((r) => r.method === req.method && r.path === path);

  return timer(latencyMs()).pipe(
    switchMap(() => {
      if (!route) return throwError(() => fail(404, `Mock API: no handler for ${req.method} ${path}`, req.url));

      const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null;
      const userId = verifyAccessToken(bearer);
      if (route.protected && !userId) return throwError(() => fail(401, 'غير مصرح', req.url));

      try {
        return of(route.handle({ req, userId }));
      } catch (err) {
        return throwError(() =>
          err instanceof HttpErrorResponse ? err : fail(500, 'Mock API handler crashed', req.url),
        );
      }
    }),
  );
};
