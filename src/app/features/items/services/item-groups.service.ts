import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, UploadEvent } from '../../../core/services/api.service';
import { withNoTimeout, withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ItemGroup, ItemGroupNode, ItemGroupOption, ItemGroupPayload } from '../models/item-group.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

@Injectable({ providedIn: 'root' })
export class ItemGroupsService {
  private readonly api = inject(ApiService);

  /** Flat, paged — for search / filtering. Filters: `status=active|inactive`. */
  list(query: ListQuery): Observable<PagedResponse<ItemGroup>> {
    return this.api.get<PagedResponse<ItemGroup>>(API_ENDPOINTS.itemGroups.list, { params: toListParams(query), context: withSkipLoader() });
  }

  /** Every active group, for selects and filters. */
  lookup(): Observable<ItemGroupOption[]> {
    return this.api.get<ItemGroupOption[]>(API_ENDPOINTS.itemGroups.lookup, { context: withSkipLoader() });
  }

  /** The whole hierarchy with roll-up counts. Items attach to its leaves only. */
  tree(): Observable<ItemGroupNode[]> {
    return this.api.get<ItemGroupNode[]>(API_ENDPOINTS.itemGroups.tree, { context: withSkipLoader() });
  }

  get(id: string): Observable<ItemGroup> {
    return this.api.get<ItemGroup>(API_ENDPOINTS.itemGroups.byId(id), { context: withSkipLoader() });
  }

  /** 409 `GROUP_HAS_ITEMS` when the parent already holds items. */
  create(payload: ItemGroupPayload): Observable<ItemGroup> {
    return this.api.post<ItemGroup>(API_ENDPOINTS.itemGroups.list, payload);
  }

  /** 422 when moved under itself / its own sub-group (server message shown as is). */
  update(id: string, payload: ItemGroupPayload): Observable<ItemGroup> {
    return this.api.put<ItemGroup>(API_ENDPOINTS.itemGroups.byId(id), payload);
  }

  /** Errors are NOT toasted — the caller handles 409 `GROUP_HAS_ITEMS` / `GROUP_HAS_CHILDREN`. */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.itemGroups.byId(id), { context: withSilentErrors() });
  }

  /** Upload / replace the group's single image (multipart `file`). Errors handled inline by the caller. */
  uploadImage(id: string, file: File): Observable<UploadEvent<ItemGroup>> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.upload<ItemGroup>(API_ENDPOINTS.itemGroups.image(id), body, {
      context: withNoTimeout(withSilentErrors(withSkipLoader())),
    });
  }

  removeImage(id: string): Observable<ItemGroup> {
    return this.api.delete<ItemGroup>(API_ENDPOINTS.itemGroups.image(id), { context: withSkipLoader() });
  }
}
