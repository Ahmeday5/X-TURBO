import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import {
  DetailedStatementEntry,
  Party,
  PartyBalanceRow,
  PartyBalancesSummary,
  PartyOption,
  PartyPayload,
  PartyStatement,
} from '../models/party.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

/** `from` / `to` are ISO dates (inclusive); omitted → from the beginning / until today. */
export interface StatementRange {
  from?: string | null;
  to?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PartiesService {
  private readonly api = inject(ApiService);

  /** Filters: `kind` (customer | supplier | both), `status` (active | inactive), `external` ('1'), `balance` (debit | credit | zero). */
  list(query: ListQuery): Observable<PagedResponse<Party>> {
    return this.api.get<PagedResponse<Party>>(API_ENDPOINTS.parties.list, { params: toListParams(query), context: withSkipLoader() });
  }

  /**
   * Active parties for selects. `role` keeps parties that can act as that role
   * (a `both` party matches either).
   */
  lookup(role?: 'customer' | 'supplier'): Observable<PartyOption[]> {
    return this.api.get<PartyOption[]>(API_ENDPOINTS.parties.lookup, { params: { role }, context: withSkipLoader() });
  }

  get(id: string): Observable<Party> {
    return this.api.get<Party>(API_ENDPOINTS.parties.byId(id), { context: withSkipLoader() });
  }

  create(payload: PartyPayload): Observable<Party> {
    return this.api.post<Party>(API_ENDPOINTS.parties.list, payload);
  }

  update(id: string, payload: PartyPayload): Observable<Party> {
    return this.api.put<Party>(API_ENDPOINTS.parties.byId(id), payload);
  }

  /** Errors are NOT toasted — the caller handles 409 `PARTY_HAS_MOVEMENTS`. */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.parties.byId(id), { context: withSilentErrors() });
  }

  statement(id: string, range: StatementRange): Observable<PartyStatement> {
    return this.api.get<PartyStatement>(API_ENDPOINTS.parties.statement(id), {
      params: { from: range.from, to: range.to },
      context: withSkipLoader(),
    });
  }

  /** Same as `statement`, each entry with its document lines. */
  statementDetailed(id: string, range: StatementRange): Observable<PartyStatement<DetailedStatementEntry>> {
    return this.api.get<PartyStatement<DetailedStatementEntry>>(API_ENDPOINTS.parties.statementDetailed(id), {
      params: { from: range.from, to: range.to },
      context: withSkipLoader(),
    });
  }

  /**
   * Balances as of `asOf` (query param, ISO date; default today).
   * Filters: `kind`, `side` (debit | credit | zero), `overLimit` ('1'), `hideZero` ('1').
   */
  balances(query: ListQuery, asOf: string | null): Observable<PagedResponse<PartyBalanceRow>> {
    return this.api.get<PagedResponse<PartyBalanceRow>>(API_ENDPOINTS.parties.balances, {
      params: { ...toListParams(query), asOf },
      context: withSkipLoader(),
    });
  }

  balancesSummary(query: ListQuery, asOf: string | null): Observable<PartyBalancesSummary> {
    return this.api.get<PartyBalancesSummary>(API_ENDPOINTS.parties.balancesSummary, {
      params: { ...toListParams(query), asOf },
      context: withSkipLoader(),
    });
  }
}
