import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ItemGroup, ItemGroupOption, ItemGroupPayload } from '../models/item-group.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

@Injectable({ providedIn: 'root' })
export class ItemGroupsService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<ItemGroup>> {
    return this.api.get<PagedResponse<ItemGroup>>(API_ENDPOINTS.itemGroups.list, { params: toListParams(query), context: withSkipLoader() });
  }

  /** Every active group, for selects and filters. */
  lookup(): Observable<ItemGroupOption[]> {
    return this.api.get<ItemGroupOption[]>(API_ENDPOINTS.itemGroups.lookup, { context: withSkipLoader() });
  }

  get(id: string): Observable<ItemGroup> {
    return this.api.get<ItemGroup>(API_ENDPOINTS.itemGroups.byId(id), { context: withSkipLoader() });
  }

  create(payload: ItemGroupPayload): Observable<ItemGroup> {
    return this.api.post<ItemGroup>(API_ENDPOINTS.itemGroups.list, payload);
  }

  update(id: string, payload: ItemGroupPayload): Observable<ItemGroup> {
    return this.api.put<ItemGroup>(API_ENDPOINTS.itemGroups.byId(id), payload);
  }

  /** Errors are NOT toasted — the caller handles 409 `GROUP_HAS_ITEMS`. */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.itemGroups.byId(id), { context: withSilentErrors() });
  }
}
