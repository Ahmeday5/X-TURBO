import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ItemLookup, ItemStockDetails, StockRow, StockSummary } from '../models/stock.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly api = inject(ApiService);

  /** Filters: `warehouseId`, `groupId`, `level` (ok | low | out). */
  list(query: ListQuery): Observable<PagedResponse<StockRow>> {
    return this.api.get<PagedResponse<StockRow>>(API_ENDPOINTS.stock.list, { params: toListParams(query), context: withSkipLoader() });
  }

  /** Totals for the same search + filters as `list`. */
  summary(query: ListQuery): Observable<StockSummary> {
    return this.api.get<StockSummary>(API_ENDPOINTS.stock.summary, { params: toListParams(query), context: withSkipLoader() });
  }

  item(itemId: string): Observable<ItemStockDetails> {
    return this.api.get<ItemStockDetails>(API_ENDPOINTS.stock.item(itemId), { context: withSkipLoader() });
  }

  /**
   * Active items for pickers. With `warehouseId`, `stock`/`available` are that
   * warehouse's balance; otherwise totals across warehouses.
   */
  itemLookup(warehouseId?: string | null): Observable<ItemLookup[]> {
    return this.api.get<ItemLookup[]>(API_ENDPOINTS.items.lookup, {
      params: { warehouseId: warehouseId ?? undefined },
      context: withSkipLoader(),
    });
  }
}
