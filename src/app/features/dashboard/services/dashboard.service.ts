import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { DashboardOverview, DashboardRange } from '../models/dashboard.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  /** The page renders its own skeleton / dimmed state, so the global loader is skipped. */
  getOverview(range: DashboardRange): Observable<DashboardOverview> {
    return this.api.get<DashboardOverview>(API_ENDPOINTS.dashboard.overview, {
      params: { range },
      context: withSkipLoader(),
    });
  }
}
