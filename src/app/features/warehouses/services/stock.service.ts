import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ItemLookup, ItemStockDetails, StockRow, StockSummary } from '../models/stock.model';

export const STOCK_ENDPOINTS = {
  list: 'stock',
  summary: 'stock/summary',
  item: (itemId: string) => `stock/items/${encodeURIComponent(itemId)}`,
  /** Lives under `items/` but is served with stock data (per-warehouse balance). */
  itemLookup: 'items/lookup',
} as const;

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly api = inject(ApiService);

  /** Filters: `warehouseId`, `groupId`, `level` (ok | low | out). */
  list(query: ListQuery): Observable<PagedResponse<StockRow>> {
    return this.api.get<PagedResponse<StockRow>>(STOCK_ENDPOINTS.list, { params: toListParams(query), context: withSkipLoader() });
  }

  /** Totals for the same search + filters as `list`. */
  summary(query: ListQuery): Observable<StockSummary> {
    return this.api.get<StockSummary>(STOCK_ENDPOINTS.summary, { params: toListParams(query), context: withSkipLoader() });
  }

  item(itemId: string): Observable<ItemStockDetails> {
    return this.api.get<ItemStockDetails>(STOCK_ENDPOINTS.item(itemId), { context: withSkipLoader() });
  }

  /**
   * Active items for pickers. With `warehouseId`, `stock`/`available` are that
   * warehouse's balance; otherwise totals across warehouses.
   */
  itemLookup(warehouseId?: string | null): Observable<ItemLookup[]> {
    return this.api.get<ItemLookup[]>(STOCK_ENDPOINTS.itemLookup, {
      params: { warehouseId: warehouseId ?? undefined },
      context: withSkipLoader(),
    });
  }
}
