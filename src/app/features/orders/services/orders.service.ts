import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { Order, OrderStats, OrderStatusChange, OrderSummary } from '../models/order.model';

export const ORDERS_ENDPOINTS = {
  list: 'orders',
  stats: 'orders/stats',
  byId: (id: string) => `orders/${encodeURIComponent(id)}`,
  status: (id: string) => `orders/${encodeURIComponent(id)}/status`,
} as const;

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<OrderSummary>> {
    return this.api.get<PagedResponse<OrderSummary>>(ORDERS_ENDPOINTS.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  /** Totals for the same search/filters as the list (status excluded, so every tab keeps its count). */
  stats(filters: Readonly<Record<string, string>>): Observable<OrderStats> {
    return this.api.get<OrderStats>(ORDERS_ENDPOINTS.stats, { params: { ...filters }, context: withSkipLoader() });
  }

  get(id: string): Observable<Order> {
    return this.api.get<Order>(ORDERS_ENDPOINTS.byId(id), { context: withSkipLoader() });
  }

  changeStatus(id: string, change: OrderStatusChange): Observable<Order> {
    return this.api.patch<Order>(ORDERS_ENDPOINTS.status(id), change);
  }
}
