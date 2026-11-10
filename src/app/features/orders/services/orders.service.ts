import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { Order, OrderStats, OrderStatusChange, OrderSummary } from '../models/order.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<OrderSummary>> {
    return this.api.get<PagedResponse<OrderSummary>>(API_ENDPOINTS.orders.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  /** Totals for the same search/filters as the list (status excluded, so every tab keeps its count). */
  stats(filters: Readonly<Record<string, string>>): Observable<OrderStats> {
    return this.api.get<OrderStats>(API_ENDPOINTS.orders.stats, { params: { ...filters }, context: withSkipLoader() });
  }

  get(id: string): Observable<Order> {
    return this.api.get<Order>(API_ENDPOINTS.orders.byId(id), { context: withSkipLoader() });
  }

  /**
   * pending → processing → shipped → delivered; `cancelled` only from pending /
   * processing. Errors are NOT toasted — the caller reloads on
   * 409 `ORDER_INVALID_TRANSITION` (the order moved since it was loaded).
   */
  changeStatus(id: string, change: OrderStatusChange): Observable<Order> {
    return this.api.patch<Order>(API_ENDPOINTS.orders.status(id), change, { context: withSilentErrors() });
  }
}
