import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { CostCenter, CostCenterOption, CostCenterPayload } from '../models/cost-center.model';

export const COST_CENTERS_ENDPOINTS = {
  list: 'cost-centers',
  lookup: 'cost-centers/lookup',
  byId: (id: string) => `cost-centers/${encodeURIComponent(id)}`,
} as const;

@Injectable({ providedIn: 'root' })
export class CostCentersService {
  private readonly api = inject(ApiService);

  /** Filters: `status` (active | inactive). */
  list(query: ListQuery): Observable<PagedResponse<CostCenter>> {
    return this.api.get<PagedResponse<CostCenter>>(COST_CENTERS_ENDPOINTS.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  lookup(): Observable<CostCenterOption[]> {
    return this.api.get<CostCenterOption[]>(COST_CENTERS_ENDPOINTS.lookup, { context: withSkipLoader() });
  }

  create(payload: CostCenterPayload): Observable<CostCenter> {
    return this.api.post<CostCenter>(COST_CENTERS_ENDPOINTS.list, payload);
  }

  update(id: string, payload: CostCenterPayload): Observable<CostCenter> {
    return this.api.put<CostCenter>(COST_CENTERS_ENDPOINTS.byId(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(COST_CENTERS_ENDPOINTS.byId(id));
  }
}
