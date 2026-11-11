import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap, throwError } from 'rxjs';
import { ApiError } from '../../../core/models/api-response.model';

/** Human order number ("ORD-00042") rather than an id. */
const ORDER_NUMBER = /^[A-Za-z]{2,5}-\d+$/;
export const isOrderNumber = (value: string): boolean => ORDER_NUMBER.test(value.trim());

const notFound = (message: string): ApiError => ({ status: 404, code: 'NOT_FOUND', message }) as ApiError;
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
   * Opens an order by its id OR its human number (`ORD-00042`). Some payloads
   * (the dashboard's recent orders, shared links, a scanned slip) only carry
   * the number — it is resolved through the list search, exact match only.
   */
  resolve(idOrNumber: string): Observable<Order> {
    if (!isOrderNumber(idOrNumber)) return this.get(idOrNumber);
    return this.list({ pageIndex: 1, pageSize: 5, search: idOrNumber, sort: null, filters: {} }).pipe(
      map((page) => page.data.find((o) => o.number.toLowerCase() === idOrNumber.toLowerCase())),
      switchMap((hit) =>
        hit ? this.get(hit.id) : throwError(() => notFound(`لم يتم العثور على الطلب ${idOrNumber} — ربما حُذف أو ليس لديك صلاحية عرضه`)),
      ),
    );
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
