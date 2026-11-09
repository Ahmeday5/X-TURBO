import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery, toListParams } from '../../../core/models/list-query.model';
import { DocKind, Document, DocumentPayload, DocumentStats, DocumentSummary } from '../models/document.model';

export const DOCUMENTS_ENDPOINTS = {
  list: 'documents',
  stats: 'documents/stats',
  byId: (id: string) => `documents/${encodeURIComponent(id)}`,
  post: (id: string) => `documents/${encodeURIComponent(id)}/post`,
  complete: (id: string) => `documents/${encodeURIComponent(id)}/complete`,
  cancel: (id: string) => `documents/${encodeURIComponent(id)}/cancel`,
  convert: (id: string) => `documents/${encodeURIComponent(id)}/convert`,
} as const;

/**
 * List filters (all optional, sent as query params): `kind` (required by the
 * screens), `status`, `partyId`, `warehouseId`, `from` / `to` (ISO dates),
 * `channel` (erp | pos), `payment` (paid | partial | unpaid).
 */
@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly api = inject(ApiService);

  list(kind: DocKind, query: ListQuery): Observable<PagedResponse<DocumentSummary>> {
    return this.api.get<PagedResponse<DocumentSummary>>(DOCUMENTS_ENDPOINTS.list, {
      params: { ...toListParams(query), kind },
      context: withSkipLoader(),
    });
  }

  stats(kind: DocKind, query: ListQuery): Observable<DocumentStats> {
    return this.api.get<DocumentStats>(DOCUMENTS_ENDPOINTS.stats, {
      params: { ...toListParams(query), kind },
      context: withSkipLoader(),
    });
  }

  get(id: string): Observable<Document> {
    return this.api.get<Document>(DOCUMENTS_ENDPOINTS.byId(id), { context: withSkipLoader() });
  }

  create(payload: DocumentPayload): Observable<Document> {
    return this.api.post<Document>(DOCUMENTS_ENDPOINTS.list, payload);
  }

  /** Drafts only. */
  update(id: string, payload: DocumentPayload): Observable<Document> {
    return this.api.put<Document>(DOCUMENTS_ENDPOINTS.byId(id), payload);
  }

  /** Drafts only. */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(DOCUMENTS_ENDPOINTS.byId(id));
  }

  /** draft → posted (applies stock / balance effects). */
  post(id: string): Observable<Document> {
    return this.api.post<Document>(DOCUMENTS_ENDPOINTS.post(id), {});
  }

  /** posted → completed (voucher transfer received, reservation delivered). Returns the updated document. */
  complete(id: string): Observable<Document> {
    return this.api.post<Document>(DOCUMENTS_ENDPOINTS.complete(id), {});
  }

  /** draft | posted → cancelled (reverses effects). */
  cancel(id: string, reason: string): Observable<Document> {
    return this.api.post<Document>(DOCUMENTS_ENDPOINTS.cancel(id), { reason });
  }

  /**
   * Creates a draft of `to` pre-filled from this document (quotation → sale,
   * sale → sale-return…). Returns the new draft.
   */
  convert(id: string, to: DocKind): Observable<Document> {
    return this.api.post<Document>(DOCUMENTS_ENDPOINTS.convert(id), { to });
  }
}
