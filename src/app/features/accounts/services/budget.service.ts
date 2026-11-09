import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { Budget, BudgetPayload } from '../models/budget.model';

export const BUDGET_ENDPOINTS = {
  get: 'budget',
  byYear: (year: number) => `budget/${year}`,
} as const;

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly api = inject(ApiService);

  get(year: number, costCenterId: string | null): Observable<Budget> {
    return this.api.get<Budget>(BUDGET_ENDPOINTS.get, { params: { year, costCenterId }, context: withSkipLoader() });
  }

  save(year: number, payload: BudgetPayload): Observable<Budget> {
    return this.api.put<Budget>(BUDGET_ENDPOINTS.byYear(year), payload);
  }
}
