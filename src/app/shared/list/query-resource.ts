import { Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, merge, Observable, of, Subject, switchMap } from 'rxjs';
import { ApiError } from '../../core/models/api-response.model';
import { apiErrorToMessage } from '../../core/utils/api-error.util';

export interface QueryResource<T> {
  /** Last successful result — kept while refetching or after an error. */
  readonly value: Signal<T | null>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<string | null>;
  reload(): void;
}

export interface QueryResourceOptions<Q> {
  /** Return false to skip loading (value resets to null), e.g. no record selected. */
  enabled?: (query: Q) => boolean;
  errorMessage?: string;
}

type Outcome<T> = { kind: 'ok'; data: T } | { kind: 'error'; message: string } | { kind: 'idle' };

/**
 * Loads `load(query)` whenever `query` changes (or `reload()` is called),
 * cancelling stale requests. The single fetch primitive for pages — paged
 * lists build on it via `createListResource`. Call in an injection context.
 */
export function createQueryResource<Q, T>(
  query: Signal<Q>,
  load: (query: Q) => Observable<T>,
  options: QueryResourceOptions<Q> = {},
): QueryResource<T> {
  const value = signal<T | null>(null);
  const loading = signal(true);
  const error = signal<string | null>(null);
  const reload$ = new Subject<void>();
  const enabled = options.enabled ?? (() => true);
  const fallback = options.errorMessage ?? 'تعذّر تحميل البيانات';

  merge(toObservable(query), reload$.pipe(map(() => query())))
    .pipe(
      switchMap((q): Observable<Outcome<T>> => {
        if (!enabled(q)) return of({ kind: 'idle' });
        loading.set(true);
        return load(q).pipe(
          map((data): Outcome<T> => ({ kind: 'ok', data })),
          catchError((err) => of<Outcome<T>>({ kind: 'error', message: apiErrorToMessage(err as ApiError, fallback) })),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe((outcome) => {
      loading.set(false);
      if (outcome.kind === 'ok') {
        value.set(outcome.data);
        error.set(null);
      } else if (outcome.kind === 'error') {
        error.set(outcome.message);
      } else {
        value.set(null);
        error.set(null);
      }
    });

  return {
    value: value.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    reload: () => reload$.next(),
  };
}
