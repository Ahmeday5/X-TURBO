import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { AdminUser, UserPayload, UserStats } from '../models/user.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

/** List filters: `role`, `status` (`active` | `suspended`). */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<AdminUser>> {
    return this.api.get<PagedResponse<AdminUser>>(API_ENDPOINTS.users.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  /** Counts for the given search (role / status filters are ignored). */
  stats(search: string): Observable<UserStats> {
    return this.api.get<UserStats>(API_ENDPOINTS.users.stats, { params: { search }, context: withSkipLoader() });
  }

  get(id: string): Observable<AdminUser> {
    return this.api.get<AdminUser>(API_ENDPOINTS.users.byId(id), { context: withSkipLoader() });
  }

  create(payload: UserPayload): Observable<AdminUser> {
    return this.api.post<AdminUser>(API_ENDPOINTS.users.list, payload);
  }

  update(id: string, payload: UserPayload): Observable<AdminUser> {
    return this.api.put<AdminUser>(API_ENDPOINTS.users.byId(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.users.byId(id));
  }

  setActive(id: string, isActive: boolean): Observable<AdminUser> {
    return this.api.post<AdminUser>(API_ENDPOINTS.users.status(id), { isActive });
  }

  resetPassword(id: string, password: string): Observable<void> {
    return this.api.post<void>(API_ENDPOINTS.users.resetPassword(id), { password });
  }
}
