import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { Warehouse, WarehouseOption, WarehousePayload } from '../models/warehouse.model';

export const WAREHOUSES_ENDPOINTS = {
  list: 'warehouses',
  lookup: 'warehouses/lookup',
  byId: (id: string) => `warehouses/${encodeURIComponent(id)}`,
} as const;

@Injectable({ providedIn: 'root' })
export class WarehousesService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<Warehouse>> {
    return this.api.get<PagedResponse<Warehouse>>(WAREHOUSES_ENDPOINTS.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  /** Every active warehouse, default first — for selects and filters. */
  lookup(): Observable<WarehouseOption[]> {
    return this.api.get<WarehouseOption[]>(WAREHOUSES_ENDPOINTS.lookup, { context: withSkipLoader() });
  }

  get(id: string): Observable<Warehouse> {
    return this.api.get<Warehouse>(WAREHOUSES_ENDPOINTS.byId(id), { context: withSkipLoader() });
  }

  create(payload: WarehousePayload): Observable<Warehouse> {
    return this.api.post<Warehouse>(WAREHOUSES_ENDPOINTS.list, payload);
  }

  update(id: string, payload: WarehousePayload): Observable<Warehouse> {
    return this.api.put<Warehouse>(WAREHOUSES_ENDPOINTS.byId(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(WAREHOUSES_ENDPOINTS.byId(id));
  }
}
