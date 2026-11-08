import { computed, Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, merge, Observable, of, Subject, switchMap, tap } from 'rxjs';
import { ListQuery } from '../../core/models/list-query.model';
import { ApiError, PagedResponse } from '../../core/models/api-response.model';
import { apiErrorToMessage } from '../../core/utils/api-error.util';

export interface ListResource<T> {
  readonly items: Signal<T[]>;
  readonly count: Signal<number>;
  readonly totalPages: Signal<number>;
  /** Any request in flight. */
  readonly loading: Signal<boolean>;
  /** Nothing loaded yet — show skeletons instead of dimming old rows. */
  readonly initialLoading: Signal<boolean>;
  readonly error: Signal<string | null>;
  reload(): void;
}

/**
 * Loads a server-paginated list whenever `query` changes, cancelling stale
 * requests (switchMap). Call in an injection context.
 */
export function createListResource<T>(
  query: Signal<ListQuery>,
  load: (query: ListQuery) => Observable<PagedResponse<T>>,
): ListResource<T> {
  const items = signal<T[]>([]);
  const count = signal(0);
  const totalPages = signal(0);
  const loading = signal(true);
  const loaded = signal(false);
  const error = signal<string | null>(null);
  const reload$ = new Subject<void>();

  merge(toObservable(query), reload$.pipe(map(() => query())))
    .pipe(
      tap(() => loading.set(true)),
      switchMap((q) =>
        load(q).pipe(
          catchError((err) => {
            error.set(apiErrorToMessage(err as ApiError, 'تعذّر تحميل البيانات'));
            return of(null);
          }),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe((res) => {
      loading.set(false);
      if (!res) return;
      error.set(null);
      loaded.set(true);
      items.set(res.data);
      count.set(res.count);
      totalPages.set(res.totalPages);
    });

  return {
    items: items.asReadonly(),
    count: count.asReadonly(),
    totalPages: totalPages.asReadonly(),
    loading: loading.asReadonly(),
    initialLoading: computed(() => loading() && !loaded()),
    error: error.asReadonly(),
    reload: () => reload$.next(),
  };
}
