import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { Account, AccountOption, AccountPayload } from '../models/account.model';

export const ACCOUNTS_ENDPOINTS = {
  /** Whole chart, flat, ordered by code (the tree is small enough to send at once). */
  list: 'accounts',
  lookup: 'accounts/lookup',
  byId: (id: string) => `accounts/${encodeURIComponent(id)}`,
} as const;

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly api = inject(ApiService);

  /** Every account with computed balances, ordered by code. */
  list(): Observable<Account[]> {
    return this.api.get<Account[]>(ACCOUNTS_ENDPOINTS.list, { context: withSkipLoader() });
  }

  /**
   * Active accounts for selects. `leaf: true` → postable accounts only,
   * `group: true` → group accounts only (parent pickers). `type` narrows by type.
   */
  lookup(options: { leaf?: boolean; group?: boolean; type?: string } = {}): Observable<AccountOption[]> {
    return this.api.get<AccountOption[]>(ACCOUNTS_ENDPOINTS.lookup, {
      params: { leaf: options.leaf ? 1 : undefined, group: options.group ? 1 : undefined, type: options.type },
      context: withSkipLoader(),
    });
  }

  get(id: string): Observable<Account> {
    return this.api.get<Account>(ACCOUNTS_ENDPOINTS.byId(id), { context: withSkipLoader() });
  }

  create(payload: AccountPayload): Observable<Account> {
    return this.api.post<Account>(ACCOUNTS_ENDPOINTS.list, payload);
  }

  update(id: string, payload: AccountPayload): Observable<Account> {
    return this.api.put<Account>(ACCOUNTS_ENDPOINTS.byId(id), payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(ACCOUNTS_ENDPOINTS.byId(id));
  }
}
