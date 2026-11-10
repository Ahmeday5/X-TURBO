import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { Voucher, VoucherKind, VoucherPayload, VoucherStats, VoucherSummary } from '../models/voucher.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

/**
 * List filters: `status`, `partyId`, `cashAccountId`, `method`, `from` / `to`.
 */
@Injectable({ providedIn: 'root' })
export class VouchersService {
  private readonly api = inject(ApiService);

  list(kind: VoucherKind, query: ListQuery): Observable<PagedResponse<VoucherSummary>> {
    return this.api.get<PagedResponse<VoucherSummary>>(API_ENDPOINTS.vouchers.list, {
      params: { ...toListParams(query), kind },
      context: withSkipLoader(),
    });
  }

  stats(kind: VoucherKind, query: ListQuery): Observable<VoucherStats> {
    return this.api.get<VoucherStats>(API_ENDPOINTS.vouchers.stats, {
      params: { ...toListParams(query), kind },
      context: withSkipLoader(),
    });
  }

  get(id: string): Observable<Voucher> {
    return this.api.get<Voucher>(API_ENDPOINTS.vouchers.byId(id), { context: withSkipLoader() });
  }

  create(payload: VoucherPayload): Observable<Voucher> {
    return this.api.post<Voucher>(API_ENDPOINTS.vouchers.list, payload);
  }

  /** Drafts only. */
  update(id: string, payload: VoucherPayload): Observable<Voucher> {
    return this.api.put<Voucher>(API_ENDPOINTS.vouchers.byId(id), payload);
  }

  /** Drafts only. */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.vouchers.byId(id));
  }

  post(id: string): Observable<Voucher> {
    return this.api.post<Voucher>(API_ENDPOINTS.vouchers.post(id), {});
  }

  cancel(id: string, reason: string): Observable<Voucher> {
    return this.api.post<Voucher>(API_ENDPOINTS.vouchers.cancel(id), { reason });
  }
}
