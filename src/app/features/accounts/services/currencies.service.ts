import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { Currency, CurrencyPayload } from '../models/currency.model';

export const CURRENCIES_ENDPOINTS = {
  list: 'currencies',
  byId: (id: string) => `currencies/${encodeURIComponent(id)}`,
} as const;

@Injectable({ providedIn: 'root' })
export class CurrenciesService {
  private readonly api = inject(ApiService);

  /** Every currency, base first. */
  list(): Observable<Currency[]> {
    return this.api.get<Currency[]>(CURRENCIES_ENDPOINTS.list, { context: withSkipLoader() });
  }

  create(payload: CurrencyPayload): Observable<Currency> {
    return this.api.post<Currency>(CURRENCIES_ENDPOINTS.list, payload);
  }

  update(id: string, payload: CurrencyPayload): Observable<Currency> {
    return this.api.put<Currency>(CURRENCIES_ENDPOINTS.byId(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(CURRENCIES_ENDPOINTS.byId(id));
  }
}
