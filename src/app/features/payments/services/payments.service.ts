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
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

/**
 * List filters: `status`, `method`, `settlement` (unsettled | settled | overdue),
 * `orderId`, `from` / `to` (ISO dates).
 */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly api = inject(ApiService);

  list(query: ListQuery): Observable<PagedResponse<PaymentSummary>> {
    return this.api.get<PagedResponse<PaymentSummary>>(API_ENDPOINTS.payments.list, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  /** Totals for the same search / filters as the list (status ignored, so every tab keeps its count). */
  stats(query: ListQuery): Observable<PaymentStats> {
    return this.api.get<PaymentStats>(API_ENDPOINTS.payments.stats, {
      params: toListParams(query),
      context: withSkipLoader(),
    });
  }

  get(id: string): Observable<Payment> {
    return this.api.get<Payment>(API_ENDPOINTS.payments.byId(id), { context: withSkipLoader() });
  }

  /** Pending → paid (courier handed over the cash / Fawry code paid). */
  confirm(id: string, payload: ConfirmPaymentPayload = {}): Observable<Payment> {
    return this.api.post<Payment>(API_ENDPOINTS.payments.confirm(id), payload);
  }

  /** Pending → failed. */
  fail(id: string, payload: FailPaymentPayload): Observable<Payment> {
    return this.api.post<Payment>(API_ENDPOINTS.payments.fail(id), payload);
  }

  /** Failed COD → pending (new collection attempt). */
  retry(id: string): Observable<Payment> {
    return this.api.post<Payment>(API_ENDPOINTS.payments.retry(id), {});
  }

  refund(id: string, payload: RefundPaymentPayload): Observable<Payment> {
    return this.api.post<Payment>(API_ENDPOINTS.payments.refund(id), payload);
  }

  settle(id: string, payload: SettlePaymentPayload = {}): Observable<Payment> {
    return this.api.post<Payment>(API_ENDPOINTS.payments.settle(id), payload);
  }
}
