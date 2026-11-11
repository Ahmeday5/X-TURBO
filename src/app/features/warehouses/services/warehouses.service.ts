import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withInlineHandling, withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { Warehouse, WarehouseOption, WarehousePayload } from '../models/warehouse.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { DocumentSummary } from '../../documents/models/document.model';
import { PendingReviewCounts } from '../utils/pending-review';

@Injectable({ providedIn: 'root' })
export class WarehousesService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<Warehouse>> {
    return this.api.get<PagedResponse<Warehouse>>(API_ENDPOINTS.warehouses.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  /** Every active warehouse, default first — for selects and filters. */
  lookup(): Observable<WarehouseOption[]> {
    return this.api.get<WarehouseOption[]>(API_ENDPOINTS.warehouses.lookup, { context: withSkipLoader() });
  }

  get(id: string): Observable<Warehouse> {
    return this.api.get<Warehouse>(API_ENDPOINTS.warehouses.byId(id), { context: withSkipLoader() });
  }

  create(payload: WarehousePayload): Observable<Warehouse> {
    return this.api.post<Warehouse>(API_ENDPOINTS.warehouses.list, payload);
  }

  update(id: string, payload: WarehousePayload): Observable<Warehouse> {
    return this.api.put<Warehouse>(API_ENDPOINTS.warehouses.byId(id), payload);
  }

  /**
   * Purchase invoices of this warehouse waiting for the warehouse manager
   * (`pending-review`). Activating / cancelling one removes it from this list.
   */
  purchaseInvoicesForReview(warehouseId: string, query: ListQuery): Observable<PagedResponse<DocumentSummary>> {
    // The endpoint takes paging / search / sort only — the warehouse is in the path.
    return this.api.get<PagedResponse<DocumentSummary>>(API_ENDPOINTS.warehouses.purchaseInvoices(warehouseId), {
      params: toListParams({ ...query, filters: {} }),
      context: withSkipLoader(),
    });
  }

  /**
   * How many purchase invoices wait for review in each warehouse — a 1-row
   * page of the review queue per warehouse, read for its `count`. Background
   * badge data: no loader, no toast, and a warehouse whose request fails is
   * simply left out (shown as nothing pending) instead of failing them all.
   */
  pendingReviewCounts(warehouseIds: readonly string[]): Observable<PendingReviewCounts> {
    if (!warehouseIds.length) return of({});
    const one = (id: string) =>
      this.api
        .get<PagedResponse<DocumentSummary>>(API_ENDPOINTS.warehouses.purchaseInvoices(id), {
          params: { pageIndex: 1, pageSize: 1 },
          context: withInlineHandling(),
        })
        .pipe(
          map((page): [string, number] => [id, page.count]),
          catchError(() => of<[string, number]>([id, 0])),
        );
    return forkJoin(warehouseIds.map(one)).pipe(map((pairs) => Object.fromEntries(pairs)));
  }

  /** Errors are NOT toasted — the caller handles 409 `WAREHOUSE_HAS_STOCK`. */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.warehouses.byId(id), { context: withSilentErrors() });
  }
}
