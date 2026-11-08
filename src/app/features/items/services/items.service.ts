import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { Item, ItemPayload } from '../models/item.model';

export const ITEMS_ENDPOINTS = {
  list: 'items',
  byId: (id: string) => `items/${encodeURIComponent(id)}`,
} as const;

@Injectable({ providedIn: 'root' })
export class ItemsService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<Item>> {
    return this.api.get<PagedResponse<Item>>(ITEMS_ENDPOINTS.list, { params: toListParams(query), context: withSkipLoader() });
  }

  get(id: string): Observable<Item> {
    return this.api.get<Item>(ITEMS_ENDPOINTS.byId(id), { context: withSkipLoader() });
  }

  create(payload: ItemPayload): Observable<Item> {
    return this.api.post<Item>(ITEMS_ENDPOINTS.list, payload);
  }

  update(id: string, payload: ItemPayload): Observable<Item> {
    return this.api.put<Item>(ITEMS_ENDPOINTS.byId(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(ITEMS_ENDPOINTS.byId(id));
  }
}
