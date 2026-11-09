import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { AdminUser, UserPayload, UserStats } from '../models/user.model';

export const USERS_ENDPOINTS = {
  list: 'users',
  stats: 'users/stats',
  byId: (id: string) => `users/${encodeURIComponent(id)}`,
  status: (id: string) => `users/${encodeURIComponent(id)}/status`,
  resetPassword: (id: string) => `users/${encodeURIComponent(id)}/reset-password`,
} as const;

/** List filters: `role`, `status` (`active` | `suspended`). */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<AdminUser>> {
    return this.api.get<PagedResponse<AdminUser>>(USERS_ENDPOINTS.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  /** Counts for the given search (role / status filters are ignored). */
  stats(search: string): Observable<UserStats> {
    return this.api.get<UserStats>(USERS_ENDPOINTS.stats, { params: { search }, context: withSkipLoader() });
  }

  get(id: string): Observable<AdminUser> {
    return this.api.get<AdminUser>(USERS_ENDPOINTS.byId(id), { context: withSkipLoader() });
  }

  create(payload: UserPayload): Observable<AdminUser> {
    return this.api.post<AdminUser>(USERS_ENDPOINTS.list, payload);
  }

  update(id: string, payload: UserPayload): Observable<AdminUser> {
    return this.api.put<AdminUser>(USERS_ENDPOINTS.byId(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(USERS_ENDPOINTS.byId(id));
  }

  setActive(id: string, isActive: boolean): Observable<AdminUser> {
    return this.api.post<AdminUser>(USERS_ENDPOINTS.status(id), { isActive });
  }

  resetPassword(id: string, password: string): Observable<void> {
    return this.api.post<void>(USERS_ENDPOINTS.resetPassword(id), { password });
  }
}
