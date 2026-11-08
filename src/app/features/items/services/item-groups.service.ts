import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ItemGroup, ItemGroupOption, ItemGroupPayload } from '../models/item-group.model';

export const ITEM_GROUPS_ENDPOINTS = {
  list: 'item-groups',
  lookup: 'item-groups/lookup',
  byId: (id: string) => `item-groups/${encodeURIComponent(id)}`,
} as const;

@Injectable({ providedIn: 'root' })
export class ItemGroupsService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<ItemGroup>> {
    return this.api.get<PagedResponse<ItemGroup>>(ITEM_GROUPS_ENDPOINTS.list, { params: toListParams(query), context: withSkipLoader() });
  }

  /** Every active group, for selects and filters. */
  lookup(): Observable<ItemGroupOption[]> {
    return this.api.get<ItemGroupOption[]>(ITEM_GROUPS_ENDPOINTS.lookup, { context: withSkipLoader() });
  }

  create(payload: ItemGroupPayload): Observable<ItemGroup> {
    return this.api.post<ItemGroup>(ITEM_GROUPS_ENDPOINTS.list, payload);
  }

  update(id: string, payload: ItemGroupPayload): Observable<ItemGroup> {
    return this.api.put<ItemGroup>(ITEM_GROUPS_ENDPOINTS.byId(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(ITEM_GROUPS_ENDPOINTS.byId(id));
  }
}
