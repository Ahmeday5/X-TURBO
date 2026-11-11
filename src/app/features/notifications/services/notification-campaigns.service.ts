import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ApiService } from '../../../core/services/api.service';
import { Campaign, CampaignCustomer, SendCampaignPayload } from '../models/notification-campaign.model';

/** Mobile push campaigns (`Customers.View`). */
@Injectable({ providedIn: 'root' })
export class NotificationCampaignsService {
  private readonly api = inject(ApiService);

  /** History. Sort: `createdAt | title | recipientCount`. */
  list(query: ListQuery): Observable<PagedResponse<Campaign>> {
    return this.api.get<PagedResponse<Campaign>>(API_ENDPOINTS.notificationCampaigns.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  get(id: string): Observable<Campaign> {
    return this.api.get<Campaign>(API_ENDPOINTS.notificationCampaigns.byId(id), { context: withSkipLoader() });
  }

  /** Background refresh while a campaign delivers — no loader, no error toasts. */
  poll(id: string): Observable<Campaign> {
    return this.api.get<Campaign>(API_ENDPOINTS.notificationCampaigns.byId(id), {
      context: withSilentErrors(withSkipLoader()),
    });
  }

  /** 201 → the campaign (usually still `pending`). 409 NO_RECIPIENTS, 422 field errors. */
  send(payload: SendCampaignPayload): Observable<Campaign> {
    return this.api.post<Campaign>(API_ENDPOINTS.notificationCampaigns.list, payload);
  }

  /** Recipient picker. Filters: `hasFcmToken=true|false`. Sort: `name | createdAt | lastLoginAt`. */
  customers(query: ListQuery): Observable<PagedResponse<CampaignCustomer>> {
    return this.api.get<PagedResponse<CampaignCustomer>>(API_ENDPOINTS.notificationCampaigns.customers, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }
}
