import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import {
  ConfirmPaymentPayload,
  FailPaymentPayload,
  Payment,
  PaymentStats,
  PaymentSummary,
  RefundPaymentPayload,
  SettlePaymentPayload,
} from '../models/payment.model';

export const PAYMENTS_ENDPOINTS = {
  list: 'payments',
  stats: 'payments/stats',
  byId: (id: string) => `payments/${encodeURIComponent(id)}`,
  confirm: (id: string) => `payments/${encodeURIComponent(id)}/confirm`,
  fail: (id: string) => `payments/${encodeURIComponent(id)}/fail`,
  retry: (id: string) => `payments/${encodeURIComponent(id)}/retry`,
  refund: (id: string) => `payments/${encodeURIComponent(id)}/refund`,
  settle: (id: string) => `payments/${encodeURIComponent(id)}/settle`,
} as const;

/**
 * List filters: `status`, `method`, `settlement` (unsettled | settled | overdue),
 * `orderId`, `from` / `to` (ISO dates).
 */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<PaymentSummary>> {
    return this.api.get<PagedResponse<PaymentSummary>>(PAYMENTS_ENDPOINTS.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  /** Totals for the same search / filters as the list (status ignored, so every tab keeps its count). */
  stats(query: ListQuery): Observable<PaymentStats> {
    return this.api.get<PaymentStats>(PAYMENTS_ENDPOINTS.stats, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  get(id: string): Observable<Payment> {
    return this.api.get<Payment>(PAYMENTS_ENDPOINTS.byId(id), { context: withSkipLoader() });
  }

  /** Pending → paid (courier handed over the cash / Fawry code paid). */
  confirm(id: string, payload: ConfirmPaymentPayload = {}): Observable<Payment> {
    return this.api.post<Payment>(PAYMENTS_ENDPOINTS.confirm(id), payload);
  }

  /** Pending → failed. */
  fail(id: string, payload: FailPaymentPayload): Observable<Payment> {
    return this.api.post<Payment>(PAYMENTS_ENDPOINTS.fail(id), payload);
  }

  /** Failed COD → pending (new collection attempt). */
  retry(id: string): Observable<Payment> {
    return this.api.post<Payment>(PAYMENTS_ENDPOINTS.retry(id), {});
  }

  refund(id: string, payload: RefundPaymentPayload): Observable<Payment> {
    return this.api.post<Payment>(PAYMENTS_ENDPOINTS.refund(id), payload);
  }

  settle(id: string, payload: SettlePaymentPayload = {}): Observable<Payment> {
    return this.api.post<Payment>(PAYMENTS_ENDPOINTS.settle(id), payload);
  }
}
