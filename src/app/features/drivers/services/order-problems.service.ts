import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ApiService } from '../../../core/services/api.service';
import { OrderProblem } from '../models/order-problem.model';

/**
 * Filters: `status` (`open` | `resolved`, empty = all), `driverId`. Search
 * matches order number, customer and driver name. Order is fixed server-side:
 * open first, newest first.
 */
@Injectable({ providedIn: 'root' })
export class OrderProblemsService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<OrderProblem>> {
    return this.api.get<PagedResponse<OrderProblem>>(API_ENDPOINTS.orderProblems.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  /**
   * Replies to the driver (pushed to the driver app) and closes the problem.
   * Silent: the caller handles 409 `PROBLEM_ALREADY_RESOLVED` and 422.
   */
  resolve(id: string, resolution: string): Observable<OrderProblem> {
    return this.api.post<OrderProblem>(API_ENDPOINTS.orderProblems.resolve(id), { resolution }, { context: withSilentErrors() });
  }
}
