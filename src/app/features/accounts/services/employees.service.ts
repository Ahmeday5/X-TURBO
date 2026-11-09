import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { Employee, EmployeePayload, EmployeeStats } from '../models/employee.model';

export const EMPLOYEES_ENDPOINTS = {
  list: 'employees',
  stats: 'employees/stats',
  byId: (id: string) => `employees/${encodeURIComponent(id)}`,
} as const;

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly api = inject(ApiService);

  /** Filters: `costCenterId`, `status`. */
  list(query: ListQuery): Observable<PagedResponse<Employee>> {
    return this.api.get<PagedResponse<Employee>>(EMPLOYEES_ENDPOINTS.list, { params: toListParams(query), context: withSkipLoader() });
  }

  stats(query: ListQuery): Observable<EmployeeStats> {
    return this.api.get<EmployeeStats>(EMPLOYEES_ENDPOINTS.stats, { params: toListParams(query), context: withSkipLoader() });
  }

  create(payload: EmployeePayload): Observable<Employee> {
    return this.api.post<Employee>(EMPLOYEES_ENDPOINTS.list, payload);
  }

  update(id: string, payload: EmployeePayload): Observable<Employee> {
    return this.api.put<Employee>(EMPLOYEES_ENDPOINTS.byId(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(EMPLOYEES_ENDPOINTS.byId(id));
  }
}
