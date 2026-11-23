import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { BookableSlot, DeliverySettings, DeliverySettingsPayload } from '../models/delivery-settings.model';

/** Express / scheduled delivery settings (`Settings.Manage`). */
@Injectable({ providedIn: 'root' })
export class DeliverySettingsService {
  private readonly api = inject(ApiService);

  get(): Observable<DeliverySettings> {
    return this.api.get<DeliverySettings>(API_ENDPOINTS.deliverySettings.root, { context: withSkipLoader() });
  }

  /** Saved whole. 422 field errors are mapped onto the form by the caller. */
  save(payload: DeliverySettingsPayload): Observable<DeliverySettings> {
    return this.api.put<DeliverySettings>(API_ENDPOINTS.deliverySettings.root, payload);
  }

  /** Slots as the customer sees them now (saved settings, current bookings). Errors shown inline, not toasted. */
  slots(): Observable<BookableSlot[]> {
    return this.api.get<BookableSlot[]>(API_ENDPOINTS.deliverySettings.slots, { context: withSilentErrors(withSkipLoader()) });
  }
}
