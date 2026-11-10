import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpEventType,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable, filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

/** Progress / completion of `ApiService.upload`. */
export type UploadEvent<T> = { kind: 'progress'; percent: number | null } | { kind: 'done'; value: T };

export interface RequestOptions {
  params?: Record<string, unknown>;
  headers?: HttpHeaders | Record<string, string>;
  context?: HttpContext;
  responseType?: 'json' | 'blob' | 'text';
}

/**
 * Thin, typed wrapper around `HttpClient`.
 *
 * Responsibilities:
 *   - prepend the API base URL (`environment.apiUrl`)
 *   - serialize query params (skipping null/undefined/empty)
 *   - unwrap the standard `ApiResponse<T>` envelope when the server uses one
 *
 * Cross-cutting concerns (auth header, global loader, error toasts) live in
 * interceptors and are toggled per-request via HttpContext tokens — see
 * `core/http/http-context.tokens.ts`.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = this.normalizeBase(environment.apiUrl);

  get<T>(endpoint: string, options: RequestOptions = {}): Observable<T> {
    return this.http
      .get<ApiResponse<T> | T>(this.url(endpoint), this.opts(options))
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  post<T>(
    endpoint: string,
    body: unknown,
    options: RequestOptions = {},
  ): Observable<T> {
    return this.http
      .post<ApiResponse<T> | T>(this.url(endpoint), body, this.opts(options))
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  put<T>(
    endpoint: string,
    body: unknown,
    options: RequestOptions = {},
  ): Observable<T> {
    return this.http
      .put<ApiResponse<T> | T>(this.url(endpoint), body, this.opts(options))
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  patch<T>(
    endpoint: string,
    body: unknown,
    options: RequestOptions = {},
  ): Observable<T> {
    return this.http
      .patch<ApiResponse<T> | T>(this.url(endpoint), body, this.opts(options))
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  delete<T>(endpoint: string, options: RequestOptions = {}): Observable<T> {
    return this.http
      .delete<ApiResponse<T> | T>(this.url(endpoint), this.opts(options))
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  /**
   * Multipart upload (POST `FormData`) that reports progress.
   *
   * Emits `{ kind: 'progress', percent }` while sending — `percent` is `null`
   * when the transport can't measure it (the Fetch backend, `withFetch()`,
   * has no upload-progress events) — then `{ kind: 'done', value }` with the
   * unwrapped response. Don't set `Content-Type`: the browser adds the
   * multipart boundary itself.
   */
  upload<T>(endpoint: string, body: FormData, options: RequestOptions = {}): Observable<UploadEvent<T>> {
    return this.http
      .post<ApiResponse<T> | T>(this.url(endpoint), body, {
        ...this.opts(options),
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        map((event): UploadEvent<T> | null => {
          if (event.type === HttpEventType.Sent) return { kind: 'progress', percent: null };
          if (event.type === HttpEventType.UploadProgress) {
            return { kind: 'progress', percent: event.total ? Math.round((100 * event.loaded) / event.total) : null };
          }
          if (event.type === HttpEventType.Response) return { kind: 'done', value: this.unwrap<T>(event.body as ApiResponse<T> | T) };
          return null;
        }),
        filter((event): event is UploadEvent<T> => event !== null),
      );
  }

  // ─────────── internals ───────────

  private url(endpoint: string): string {
    return `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
  }

  private opts(options: RequestOptions): {
    params?: HttpParams;
    headers?: HttpHeaders | Record<string, string>;
    context?: HttpContext;
  } {
    return {
      params: options.params ? this.toParams(options.params) : undefined,
      headers: options.headers,
      context: options.context,
    };
  }

  private toParams(input: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(input)) {
      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value)) {
        for (const v of value) params = params.append(key, String(v));
      } else {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  /**
   * Normalize both `{ success, data }` envelopes and raw `<T>` payloads.
   * A real envelope (has a boolean `success`) always yields its `data` —
   * including `null` for void operations (`{ success: true, data: null }`).
   */
  private unwrap<T>(res: ApiResponse<T> | T): T {
    if (res && typeof res === 'object') {
      const env = res as ApiResponse<T>;
      if (typeof env.success === 'boolean') return env.data as T;
      if ('data' in env) return (env.data ?? (env as unknown as T)) as T;
    }
    return res as T;
  }

  private normalizeBase(raw: string): string {
    return raw.replace(/\/+$/, '');
  }
}
