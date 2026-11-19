import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ApiService } from '../../../core/services/api.service';
import { Driver, DriverLookup, DriverPayload, DriverStats } from '../models/driver.model';

/**
 * List filters: `status` (`active` | `suspended`). Search matches name, phone
 * and plate number. Writes are silent — callers map the 409 codes
 * (`PHONE_TAKEN`, `DRIVER_HAS_ORDERS`) to the right field / next step.
 */
@Injectable({ providedIn: 'root' })
export class DriversService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<Driver>> {
    return this.api.get<PagedResponse<Driver>>(API_ENDPOINTS.drivers.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  stats(): Observable<DriverStats> {
    return this.api.get<DriverStats>(API_ENDPOINTS.drivers.stats, { context: withSilentErrors(withSkipLoader()) });
  }

  /** Active drivers only, least busy first. */
  lookup(): Observable<DriverLookup[]> {
    return this.api.get<DriverLookup[]>(API_ENDPOINTS.drivers.lookup, { context: withSkipLoader() });
  }

  get(id: string): Observable<Driver> {
    return this.api.get<Driver>(API_ENDPOINTS.drivers.byId(id), { context: withSkipLoader() });
  }

  create(payload: DriverPayload): Observable<Driver> {
    return this.api.post<Driver>(API_ENDPOINTS.drivers.list, payload, { context: withSilentErrors() });
  }

  update(id: string, payload: DriverPayload): Observable<Driver> {
    return this.api.put<Driver>(API_ENDPOINTS.drivers.byId(id), payload, { context: withSilentErrors() });
  }

  /** Suspending signs the driver out of the app at once and stops their push notifications. */
  setActive(id: string, isActive: boolean): Observable<Driver> {
    return this.api.post<Driver>(API_ENDPOINTS.drivers.status(id), { isActive });
  }

  /** Signs the driver out of every device. */
  resetPassword(id: string, password: string): Observable<void> {
    return this.api.post<void>(API_ENDPOINTS.drivers.resetPassword(id), { password });
  }

  /** Only for a driver with no orders — 409 `DRIVER_HAS_ORDERS` otherwise. */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.drivers.byId(id), { context: withSilentErrors() });
  }
}
