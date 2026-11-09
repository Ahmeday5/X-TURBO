import { computed, Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ListQuery } from '../../core/models/list-query.model';
import { PagedResponse } from '../../core/models/api-response.model';
import { createQueryResource } from './query-resource';

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
  const page = createQueryResource(query, load);

  return {
    items: computed(() => page.value()?.data ?? []),
    count: computed(() => page.value()?.count ?? 0),
    totalPages: computed(() => page.value()?.totalPages ?? 0),
    loading: page.loading,
    initialLoading: computed(() => page.loading() && !page.value()),
    error: page.error,
    reload: page.reload,
  };
}
