import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ApiService } from '../../../core/services/api.service';
import { AppCustomer, AppCustomerStats, AppCustomerTargetStatus } from '../models/app-customer.model';

/**
 * Mobile-app customers (`Customers.View`). List filters: `status`
 * (pending | active | blocked, empty = all) and `includeUnverified`
 * (default false — hides sign-ups that never entered the SMS code). Search
 * matches name, phone and email.
 */
@Injectable({ providedIn: 'root' })
export class AppCustomersService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<AppCustomer>> {
    return this.api.get<PagedResponse<AppCustomer>>(API_ENDPOINTS.appCustomers.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  /** Background counters (tabs + sidebar badge) — never toasts. */
  stats(): Observable<AppCustomerStats> {
    return this.api.get<AppCustomerStats>(API_ENDPOINTS.appCustomers.stats, { context: withSilentErrors(withSkipLoader()) });
  }

  get(id: string): Observable<AppCustomer> {
    return this.api.get<AppCustomer>(API_ENDPOINTS.appCustomers.byId(id), { context: withSkipLoader() });
  }

  /**
   * Activate / unblock (`active`) or block (`blocked`) → the updated customer.
   * Idempotent: setting the current status returns the row unchanged. Silent —
   * the caller maps 409 `PHONE_NOT_VERIFIED`, 404, 403 and 422 to a message.
   */
  setStatus(id: string, status: AppCustomerTargetStatus): Observable<AppCustomer> {
    return this.api.post<AppCustomer>(API_ENDPOINTS.appCustomers.status(id), { status }, { context: withSilentErrors() });
  }
}
