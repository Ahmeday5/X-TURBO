import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { DeliveryZone, DeliveryZonePayload } from '../models/delivery-zone.model';

/** Delivery zones (`Settings.Manage`). At most 27 rows — returned whole, not paged. */
@Injectable({ providedIn: 'root' })
export class DeliveryZonesService {
  private readonly api = inject(ApiService);

  list(): Observable<DeliveryZone[]> {
    return this.api.get<DeliveryZone[]>(API_ENDPOINTS.deliveryZones.list, { context: withSkipLoader() });
  }

  /** May fail with 409 `DUPLICATE_ZONE` (toasted; 422 field errors go to the form). */
  create(payload: DeliveryZonePayload): Observable<DeliveryZone> {
    return this.api.post<DeliveryZone>(API_ENDPOINTS.deliveryZones.list, payload);
  }

  update(id: string, payload: DeliveryZonePayload): Observable<DeliveryZone> {
    return this.api.put<DeliveryZone>(API_ENDPOINTS.deliveryZones.byId(id), payload);
  }

  /** Errors are NOT toasted — the caller handles 409 `ZONE_IN_USE` (offers to deactivate). */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.deliveryZones.byId(id), { context: withSilentErrors() });
  }
}
