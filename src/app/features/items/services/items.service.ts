import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { Item, ItemPayload } from '../models/item.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

@Injectable({ providedIn: 'root' })
export class ItemsService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<Item>> {
    return this.api.get<PagedResponse<Item>>(API_ENDPOINTS.items.list, { params: toListParams(query), context: withSkipLoader() });
  }

  get(id: string): Observable<Item> {
    return this.api.get<Item>(API_ENDPOINTS.items.byId(id), { context: withSkipLoader() });
  }

  create(payload: ItemPayload): Observable<Item> {
    return this.api.post<Item>(API_ENDPOINTS.items.list, payload);
  }

  update(id: string, payload: ItemPayload): Observable<Item> {
    return this.api.put<Item>(API_ENDPOINTS.items.byId(id), payload);
  }

  /**
   * Errors are NOT toasted — the caller decides (409 `ITEM_HAS_MOVEMENTS`
   * offers to deactivate the item instead).
   */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.items.byId(id), { context: withSilentErrors() });
  }
}
