import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';
import { ToastService } from '../services/toast.service';
import { SKIP_ERROR_TOAST } from '../http/http-context.tokens';
import { ApiError, ApiFieldErrors } from '../models/api-response.model';
import { environment } from '../../../environments/environment';
import { API_ERROR_CODES } from '../http/api-error-codes';
import { waitText } from '../utils/api-error.util';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';

/**
 * Normalizes every HTTP failure into an `ApiError` and (unless the caller
 * opted out) surfaces a toast. Components see `ApiError` in their error
 * branch — never the raw `HttpErrorResponse`.
 *
 * Every error is also logged to the console — silencing it would make
 * "Failed to fetch" / CORS / network errors invisible during development
 * and leave us blind in production diagnostics.
 *
 * If your app needs to localize/translate backend error strings, add that
 * as a pluggable step inside `resolveMessage()` below rather than scattering
 * translation calls through feature code.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: unknown) => {
      // Errors raised by a nested request (e.g. the token refresh issued from
      // the auth interceptor) were already normalized + logged by their own
      // pass through this interceptor — forward them untouched.
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      const apiError = normalizeError(err, req.url);
      logError(req.method, req.url, err, apiError);

      // Permissions were revoked server-side mid-session: re-read them so the
      // sidebar / buttons the user can no longer use disappear.
      if (apiError.status === 403 && auth.isAuthenticated()) {
        auth.syncPermissions();
      }

      // Suppress toasts when the user is not authenticated — covers in-flight
      // requests that fail after an explicit logout (the token was just cleared).
      // A 401 outside login is owned by the auth flow, which either retries
      // transparently or logs out with its own "session expired" notice.
      const silent =
        req.context.get(SKIP_ERROR_TOAST) ||
        req.url.includes(API_ENDPOINTS.auth.refresh) ||
        (apiError.status === 401 && !req.url.includes(API_ENDPOINTS.auth.login)) ||
        !auth.isAuthenticated();

      if (!silent) toast.error(apiError.message);

      return throwError(() => apiError);
    })
  );
};

function normalizeError(err: HttpErrorResponse, url: string): ApiError {
  const status = err.status ?? 0;
  const body = err.error && typeof err.error === 'object' ? err.error : {};

  const code: string | undefined = typeof body?.code === 'string' ? body.code : undefined;
  const traceId: string | undefined =
    (typeof body?.traceId === 'string' && body.traceId) ||
    err.headers?.get('X-Correlation-Id') ||
    undefined;
  const retryAfterSec = parseRetryAfter(err.headers?.get('Retry-After'));

  const rawMessage: string =
    body?.message || body?.error || body?.detail || body?.title || '';
  let message =
    rawMessage.trim() || codeMessage(code, retryAfterSec) || statusMessage(status, err, url);

  // Unexpected server faults: give the user something to quote to support.
  if ((status >= 500 || code === API_ERROR_CODES.internal) && traceId) {
    message = `${message} (رقم المتابعة: ${traceId})`;
  }

  const fieldErrors: ApiFieldErrors | undefined =
    body?.errors && typeof body.errors === 'object' ? body.errors : undefined;

  return { status, code, message, fieldErrors, traceId, retryAfterSec, raw: body };
}

/** Fallback text for well-known codes when the server sent no message. */
function codeMessage(code: string | undefined, retryAfterSec?: number): string | null {
  switch (code) {
    case API_ERROR_CODES.concurrencyConflict:
      return 'البيانات اتعدلت من مستخدم آخر، حدّث الصفحة وحاول مرة أخرى';
    case API_ERROR_CODES.loginLocked:
      return `تم قفل الحساب مؤقتًا بسبب محاولات دخول خاطئة متكررة، حاول بعد ${waitText(retryAfterSec, 15 * 60)}`;
    case API_ERROR_CODES.rateLimited:
      return `طلبات كثيرة، حاول بعد ${waitText(retryAfterSec, 60)}`;
    case API_ERROR_CODES.sessionExpired:
      return 'انتهت صلاحية الجلسة، برجاء تسجيل الدخول مرة أخرى';
    case API_ERROR_CODES.forbidden:
      return 'ليس لديك صلاحية لتنفيذ هذا الإجراء';
    case API_ERROR_CODES.notFound:
    case API_ERROR_CODES.routeNotFound:
      return 'العنصر المطلوب غير موجود';
    default:
      return null;
  }
}

function parseRetryAfter(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs) && secs >= 0) return Math.ceil(secs);
  const at = Date.parse(raw);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

function statusMessage(status: number, err: HttpErrorResponse, url: string): string {
  if (status === 0) {
    // Browser blocked the request before it could complete — most commonly
    // CORS or DNS/network failure. The browser hides the real cause for
    // security reasons; the only readable hint is `err.message`.
    return err.message?.includes('Failed to fetch')
      ? 'تعذر الاتصال بالخادم (مشكلة في الشبكة أو CORS)'
      : 'تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت';
  }

  const messages: Record<number, string> = {
    400: 'الطلب غير صالح',
    401: url.includes(API_ENDPOINTS.auth.login)
      ? 'بيانات الدخول غير صحيحة'
      : 'غير مصرح، برجاء تسجيل الدخول مرة أخرى',
    403: 'ليس لديك صلاحية لتنفيذ هذا الإجراء',
    404: 'العنصر المطلوب غير موجود',
    409: 'حدث تعارض في البيانات',
    422: 'البيانات المدخلة غير صحيحة',
    429: 'طلبات كثيرة، برجاء الانتظار قليلًا',
    500: 'خطأ في الخادم، حاول مرة أخرى لاحقًا',
    502: 'الخدمة غير متاحة مؤقتًا',
    503: 'الخدمة غير متاحة مؤقتًا',
    504: 'انتهت مهلة الاتصال بالخادم',
  };

  return messages[status] ?? `حدث خطأ غير متوقع (${status})`;
}

function logError(
  method: string,
  url: string,
  err: HttpErrorResponse,
  apiError: ApiError,
): void {
  // Always group + log in dev. In production we still log a single line so
  // users can copy/paste a useful trace into bug reports.
  if (environment.production) {
    console.error(
      `[HTTP ${apiError.status}${apiError.code ? ` ${apiError.code}` : ''}] ${method} ${url} — ${apiError.message}` +
        (apiError.traceId ? ` [traceId ${apiError.traceId}]` : ''),
    );
    return;
  }

  /* eslint-disable no-console */
  const groupLabel = `[HTTP ${apiError.status || 'NETWORK'}] ${method} ${url}`;
  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(groupLabel);
  } else {
    console.error(groupLabel);
  }
  console.error('Message :', apiError.message);
  if (apiError.code) console.error('Code    :', apiError.code);
  if (apiError.traceId) console.error('TraceId :', apiError.traceId);
  console.error('Status  :', err.status, err.statusText || '(no statusText)');
  if (apiError.fieldErrors) console.error('Fields  :', apiError.fieldErrors);
  if (err.error) console.error('Body    :', err.error);
  console.error('Raw     :', err);
  if (err.status === 0) {
    console.warn(
      'Browser-level network/CORS failure. Likely causes:\n' +
        '  • Backend CORS rejected the origin (run via dev proxy)\n' +
        '  • DNS / connection failure\n' +
        '  • Mixed-content (HTTPS page calling HTTP API)\n' +
        '  • Browser/extension blocked the request',
    );
  }
  if (typeof console.groupEnd === 'function') console.groupEnd();
  /* eslint-enable no-console */
}
