import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { Account, AccountOption, AccountPayload, TrialBalance } from '../models/account.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly api = inject(ApiService);

  /** Every account with computed balances, ordered by code. */
  list(): Observable<Account[]> {
    return this.api.get<Account[]>(API_ENDPOINTS.accounts.list, { context: withSkipLoader() });
  }

  /**
   * Active accounts for selects. `leaf: true` → postable accounts only,
   * `group: true` → group accounts only (parent pickers). `type` narrows by type.
   */
  lookup(options: { leaf?: boolean; group?: boolean; type?: string } = {}): Observable<AccountOption[]> {
    return this.api.get<AccountOption[]>(API_ENDPOINTS.accounts.lookup, {
      params: { leaf: options.leaf ? 1 : undefined, group: options.group ? 1 : undefined, type: options.type },
      context: withSkipLoader(),
    });
  }

  /** Server-side trial balance as of `asOf` (ISO date; default today). */
  trialBalance(asOf?: string | null): Observable<TrialBalance> {
    return this.api.get<TrialBalance>(API_ENDPOINTS.accounts.trialBalance, { params: { asOf }, context: withSkipLoader() });
  }

  get(id: string): Observable<Account> {
    return this.api.get<Account>(API_ENDPOINTS.accounts.byId(id), { context: withSkipLoader() });
  }

  create(payload: AccountPayload): Observable<Account> {
    return this.api.post<Account>(API_ENDPOINTS.accounts.list, payload);
  }

  update(id: string, payload: AccountPayload): Observable<Account> {
    return this.api.put<Account>(API_ENDPOINTS.accounts.byId(id), payload);
  }

  /** Errors are NOT toasted — the caller handles 409 `ACCOUNT_HAS_POSTINGS`. */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.accounts.byId(id), { context: withSilentErrors() });
  }
}
