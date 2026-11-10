import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { Warehouse, WarehouseOption, WarehousePayload } from '../models/warehouse.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

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

  /** Errors are NOT toasted — the caller handles 409 `WAREHOUSE_HAS_STOCK`. */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.warehouses.byId(id), { context: withSilentErrors() });
  }
}
