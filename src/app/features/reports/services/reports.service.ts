import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { ProductReportRow, ReportRange, ReportsOverview } from '../models/report.model';

export const REPORTS_ENDPOINTS = {
  overview: 'reports/overview',
  products: 'reports/products',
} as const;

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(ApiService);

  overview(range: ReportRange): Observable<ReportsOverview> {
    return this.api.get<ReportsOverview>(REPORTS_ENDPOINTS.overview, { params: { range }, context: withSkipLoader() });
  }

  /** Product performance; `range` travels in `query.filters`. */
  products(query: ListQuery): Observable<PagedResponse<ProductReportRow>> {
    return this.api.get<PagedResponse<ProductReportRow>>(REPORTS_ENDPOINTS.products, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }
}
