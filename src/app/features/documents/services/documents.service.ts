import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { DocKind, Document, DocumentPayload, DocumentStats, DocumentSummary } from '../models/document.model';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';

/**
 * List filters (all optional, sent as query params): `kind` (required by the
 * screens), `status`, `partyId`, `warehouseId`, `from` / `to` (ISO dates),
 * `channel` (erp | pos), `payment` (paid | partial | unpaid).
 */
@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly api = inject(ApiService);

  list(kind: DocKind, query: ListQuery): Observable<PagedResponse<DocumentSummary>> {
    return this.api.get<PagedResponse<DocumentSummary>>(API_ENDPOINTS.documents.list, {
      params: { ...toListParams(query), kind },
      context: withSkipLoader(),
    });
  }

  stats(kind: DocKind, query: ListQuery): Observable<DocumentStats> {
    return this.api.get<DocumentStats>(API_ENDPOINTS.documents.stats, {
      params: { ...toListParams(query), kind },
      context: withSkipLoader(),
    });
  }

  get(id: string): Observable<Document> {
    return this.api.get<Document>(API_ENDPOINTS.documents.byId(id), { context: withSkipLoader() });
  }

  create(payload: DocumentPayload): Observable<Document> {
    return this.api.post<Document>(API_ENDPOINTS.documents.list, payload);
  }

  /** Open documents only (draft / pending-review). */
  update(id: string, payload: DocumentPayload): Observable<Document> {
    return this.api.put<Document>(API_ENDPOINTS.documents.byId(id), payload);
  }

  // ── Lifecycle actions ──
  // Errors are NOT toasted here: the caller reacts to the business code
  // (stale status → reload, DOCUMENT_HAS_RETURNS → open the return, …).

  /** Open documents only (draft / pending-review). */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.documents.byId(id), { context: withSilentErrors() });
  }

  /**
   * draft | pending-review → posted (applies stock / balance effects; may fail
   * with CREDIT_LIMIT_EXCEEDED). For a purchase pending review this is the
   * warehouse manager's "activate / receive".
   */
  post(id: string): Observable<Document> {
    return this.api.post<Document>(API_ENDPOINTS.documents.post(id), {}, { context: withSilentErrors() });
  }

  /** posted → completed (voucher transfer received, reservation delivered). Returns the updated document. */
  complete(id: string): Observable<Document> {
    return this.api.post<Document>(API_ENDPOINTS.documents.complete(id), {}, { context: withSilentErrors() });
  }

  /**
   * draft | pending-review | posted → cancelled (reverses effects, if any). Refused when the goods were
   * already consumed, or while a return of this document is still active.
   */
  cancel(id: string, reason: string): Observable<Document> {
    return this.api.post<Document>(API_ENDPOINTS.documents.cancel(id), { reason }, { context: withSilentErrors() });
  }

  /**
   * Creates a draft of `to` pre-filled from this document (quotation → sale,
   * sale → sale-return…). Returns the new draft.
   */
  convert(id: string, to: DocKind): Observable<Document> {
    return this.api.post<Document>(API_ENDPOINTS.documents.convert(id), { to }, { context: withSilentErrors() });
  }
}
