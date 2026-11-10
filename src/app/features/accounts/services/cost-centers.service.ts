import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { CostCenter, CostCenterOption, CostCenterPayload } from '../models/cost-center.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

@Injectable({ providedIn: 'root' })
export class CostCentersService {
  private readonly api = inject(ApiService);

  /** Filters: `status` (active | inactive). */
  list(query: ListQuery): Observable<PagedResponse<CostCenter>> {
    return this.api.get<PagedResponse<CostCenter>>(API_ENDPOINTS.costCenters.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  lookup(): Observable<CostCenterOption[]> {
    return this.api.get<CostCenterOption[]>(API_ENDPOINTS.costCenters.lookup, { context: withSkipLoader() });
  }

  get(id: string): Observable<CostCenter> {
    return this.api.get<CostCenter>(API_ENDPOINTS.costCenters.byId(id), { context: withSkipLoader() });
  }

  create(payload: CostCenterPayload): Observable<CostCenter> {
    return this.api.post<CostCenter>(API_ENDPOINTS.costCenters.list, payload);
  }

  update(id: string, payload: CostCenterPayload): Observable<CostCenter> {
    return this.api.put<CostCenter>(API_ENDPOINTS.costCenters.byId(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.costCenters.byId(id));
  }
}
