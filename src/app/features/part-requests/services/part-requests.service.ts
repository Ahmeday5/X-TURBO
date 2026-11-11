import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ApiService } from '../../../core/services/api.service';
import { PartRequest, QuotePayload, RejectPayload } from '../models/part-request.model';

/** Part requests from the mobile app (`Orders.View`). Filters: `status`. */
@Injectable({ providedIn: 'root' })
export class PartRequestsService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<PartRequest>> {
    return this.api.get<PagedResponse<PartRequest>>(API_ENDPOINTS.partRequests.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  get(id: string): Observable<PartRequest> {
    return this.api.get<PartRequest>(API_ENDPOINTS.partRequests.byId(id), { context: withSkipLoader() });
  }

  /** Protected photo as a blob (a plain `<img src>` wouldn't send the token). */
  image(id: string, imageId: string): Observable<Blob> {
    return this.api.getBlob(API_ENDPOINTS.partRequests.image(id, imageId), { context: withSilentErrors(withSkipLoader()) });
  }

  /** Sends the offer — the customer gets a «وصلك عرض سعر» notification. 409 CANNOT_QUOTE if not reviewable. */
  quote(id: string, payload: QuotePayload): Observable<PartRequest> {
    return this.api.post<PartRequest>(API_ENDPOINTS.partRequests.quote(id), payload);
  }

  /** The customer gets a «تعذّر توفير القطعة» notification. 409 CANNOT_REJECT if not reviewable. */
  reject(id: string, payload: RejectPayload): Observable<PartRequest> {
    return this.api.post<PartRequest>(API_ENDPOINTS.partRequests.reject(id), payload);
  }
}
