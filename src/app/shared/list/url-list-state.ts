import { computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';
import { ListQuery, SortState } from '../../core/models/list-query.model';

export type ViewMode = 'table' | 'cards';

export interface UrlListStateConfig {
  pageSize?: number;
  /** Sort applied when the URL has none. */
  defaultSort?: SortState | null;
  /** Feature filter keys mirrored to the URL (e.g. `['groupId', 'status']`). */
  filters?: readonly string[];
  defaultView?: ViewMode;
}

/** URL keys — short, stable, and shared by every list in the app. */
const Q = { search: 'q', page: 'page', size: 'size', sort: 'sort', dir: 'dir', view: 'view' } as const;

/**
 * List state (search, page, size, sort, filters, view) stored in the URL
 * query string, so a refresh, a shared link or Back restores the exact list.
 * Defaults are omitted from the URL to keep links clean.
 *
 * Call in an injection context (a field initializer):
 *
 *   readonly list = new UrlListState({ pageSize: 10, filters: ['groupId'] });
 *   readonly items = createListResource(this.list.query, (q) => this.api.list(q));
 */
export class UrlListState {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly params: Signal<ParamMap>;

  private readonly pageSize: number;
  private readonly defaultSort: SortState | null;
  private readonly filterKeys: readonly string[];
  private readonly defaultView: ViewMode;

  /** The query to send to the API; only changes when a query-relevant param does. */
  readonly query: Signal<ListQuery>;
  readonly view: Signal<ViewMode>;
  /** Number of active feature filters — drives "clear filters". */
  readonly activeFilters: Signal<number>;

  constructor(config: UrlListStateConfig = {}) {
    this.pageSize = config.pageSize ?? 10;
    this.defaultSort = config.defaultSort ?? null;
    this.filterKeys = config.filters ?? [];
    this.defaultView = config.defaultView ?? 'table';
    this.params = toSignal(this.route.queryParamMap, { requireSync: true });

    this.query = computed(() => this.read(this.params()), {
      equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    });
    this.view = computed(() => {
      const v = this.params().get(Q.view);
      return v === 'table' || v === 'cards' ? v : this.defaultView;
    });
    this.activeFilters = computed(() => Object.keys(this.query().filters).length);
  }

  setSearch(term: string): void {
    this.patch({ [Q.search]: term.trim() || null });
  }

  setPage(page: number): void {
    this.patch({ [Q.page]: page > 1 ? page : null }, false);
  }

  setPageSize(size: number): void {
    this.patch({ [Q.size]: size === this.pageSize ? null : size });
  }

  setSort(sort: SortState | null): void {
    const isDefault = sort?.key === this.defaultSort?.key && sort?.dir === this.defaultSort?.dir;
    this.patch(sort && !isDefault ? { [Q.sort]: sort.key, [Q.dir]: sort.dir } : { [Q.sort]: null, [Q.dir]: null });
  }

  /** Header click: asc → desc → back to the default sort. */
  toggleSort(key: string): void {
    const current = this.query().sort;
    if (current?.key !== key) this.setSort({ key, dir: 'asc' });
    else if (current.dir === 'asc') this.setSort({ key, dir: 'desc' });
    else this.setSort(null);
  }

  setFilter(key: string, value: string | null): void {
    this.patch({ [key]: value || null });
  }

  /** Several filters in ONE navigation (e.g. a date range's from + to). */
  setFilters(changes: Readonly<Record<string, string | null>>): void {
    this.patch(Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v || null])));
  }

  clearFilters(): void {
    this.patch(Object.fromEntries([Q.search, ...this.filterKeys].map((k) => [k, null])));
  }

  setView(view: ViewMode): void {
    this.patch({ [Q.view]: view === this.defaultView ? null : view }, false);
  }

  /**
   * A page-level URL param outside the list query (a report range, the id of
   * an open drawer…). Survives refresh like everything else here.
   */
  param(key: string, fallback = ''): Signal<string> {
    return computed(() => this.params().get(key) ?? fallback);
  }

  /** Pass `null` (or the default) to drop the param and keep the URL clean. */
  setParam(key: string, value: string | null, resetPage = false): void {
    this.patch({ [key]: value || null }, resetPage);
  }

  /** Several page-level params in one navigation (separate calls can overwrite each other). */
  setParams(changes: Readonly<Record<string, string | null>>, resetPage = false): void {
    const params: Params = {};
    for (const [key, value] of Object.entries(changes)) params[key] = value || null;
    this.patch(params, resetPage);
  }

  private read(p: ParamMap): ListQuery {
    const sortKey = p.get(Q.sort);
    const filters: Record<string, string> = {};
    for (const key of this.filterKeys) {
      const value = p.get(key);
      if (value) filters[key] = value;
    }
    return {
      pageIndex: positiveInt(p.get(Q.page)) ?? 1,
      pageSize: positiveInt(p.get(Q.size)) ?? this.pageSize,
      search: p.get(Q.search) ?? '',
      sort: sortKey ? { key: sortKey, dir: p.get(Q.dir) === 'desc' ? 'desc' : 'asc' } : this.defaultSort,
      filters,
    };
  }

  /** Merges into the current URL; any change except paging/view returns to page 1. */
  private patch(changes: Params, resetPage = true): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: resetPage ? { ...changes, [Q.page]: null } : changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function positiveInt(raw: string | null): number | null {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
