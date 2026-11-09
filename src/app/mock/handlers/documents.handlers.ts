import { DocKind, DocumentPayload, DocumentStats, DocumentSummary } from '../../features/documents/models/document.model';
import { DOCUMENTS_ENDPOINTS } from '../../features/documents/services/documents.service';
import { actorName, findOr404, inRange, round2 } from '../db/db-utils';
import {
  cancelDocument,
  completeDocument,
  convertDocument,
  createDocument,
  deleteDocument,
  documentRows,
  postDocument,
  toSummary,
  updateDocument,
} from '../db/documents.db';
import { bodyOf, CollectionOptions, filterCollection, queryCollection } from '../mock-collection';
import { MockContext, MockRoute, ok } from '../mock-http';

const LIST_OPTIONS: CollectionOptions<DocumentSummary> = {
  searchFields: ['number', 'partyName', 'reference', 'warehouseName', 'toWarehouseName', 'notes', 'createdBy'],
  filters: {
    kind: (row, v) => row.kind === v,
    status: (row, v) => row.status === v,
    partyId: (row, v) => row.partyId === v,
    warehouseId: (row, v) => row.warehouseId === v || row.toWarehouseId === v,
    channel: (row, v) => row.channel === v,
    payment: (row, v) =>
      v === 'paid' ? row.remaining <= 0 : v === 'unpaid' ? row.paid <= 0 && row.remaining > 0 : row.paid > 0 && row.remaining > 0,
    overdue: (row) => !!row.dueDate && row.remaining > 0 && row.status === 'posted' && row.dueDate < new Date().toISOString().slice(0, 10),
  },
};

function filtered(query: URLSearchParams): DocumentSummary[] {
  const from = query.get('from');
  const to = query.get('to');
  return documentRows()
    .filter((d) => inRange(d.date, from, to))
    .map(toSummary);
}

function list({ query }: MockContext) {
  // Newest first unless the screen asks for a sort.
  if (!query.get('sortBy')) {
    query.set('sortBy', 'createdAt');
    query.set('sortDir', 'desc');
  }
  return ok(queryCollection(filtered(query), query, LIST_OPTIONS));
}

function stats({ query }: MockContext) {
  // Stats ignore the status filter so the tab counters stay meaningful.
  const q = new URLSearchParams(query);
  q.delete('status');
  const rows = filterCollection(filtered(q), q, LIST_OPTIONS);
  const live = rows.filter((r) => r.status !== 'cancelled');
  const result: DocumentStats = {
    count: rows.length,
    draft: rows.filter((r) => r.status === 'draft').length,
    posted: rows.filter((r) => r.status === 'posted').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    total: round2(live.reduce((s, r) => s + r.total, 0)),
    paid: round2(live.reduce((s, r) => s + r.paid, 0)),
    remaining: round2(live.reduce((s, r) => s + r.remaining, 0)),
    totalQty: live.reduce((s, r) => s + r.totalQty, 0),
  };
  return ok(result);
}

function get({ params, req }: MockContext) {
  return ok(findOr404(documentRows(), params['id'], req.url, 'المستند'));
}

function create({ req, userId }: MockContext) {
  return ok(createDocument(bodyOf<DocumentPayload>(req.body), actorName(userId), req.url), 201);
}

function update({ params, req }: MockContext) {
  return ok(updateDocument(params['id'], bodyOf<DocumentPayload>(req.body), req.url));
}

function remove({ params, req }: MockContext) {
  deleteDocument(params['id'], req.url);
  return ok(null);
}

function post({ params, req }: MockContext) {
  return ok(postDocument(params['id'], req.url));
}

function complete({ params, req, userId }: MockContext) {
  return ok(completeDocument(params['id'], actorName(userId), req.url));
}

function cancel({ params, req }: MockContext) {
  return ok(cancelDocument(params['id'], bodyOf<{ reason?: string }>(req.body).reason ?? '', req.url));
}

function convert({ params, req, userId }: MockContext) {
  return ok(convertDocument(params['id'], bodyOf<{ to: DocKind }>(req.body).to, actorName(userId), req.url), 201);
}

const BY_ID = 'documents/:id';

export const DOCUMENTS_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: DOCUMENTS_ENDPOINTS.stats, protected: true, handle: stats },
  { method: 'GET', path: DOCUMENTS_ENDPOINTS.list, protected: true, handle: list },
  { method: 'POST', path: DOCUMENTS_ENDPOINTS.list, protected: true, handle: create },
  { method: 'GET', path: BY_ID, protected: true, handle: get },
  { method: 'PUT', path: BY_ID, protected: true, handle: update },
  { method: 'DELETE', path: BY_ID, protected: true, handle: remove },
  { method: 'POST', path: `${BY_ID}/post`, protected: true, handle: post },
  { method: 'POST', path: `${BY_ID}/complete`, protected: true, handle: complete },
  { method: 'POST', path: `${BY_ID}/cancel`, protected: true, handle: cancel },
  { method: 'POST', path: `${BY_ID}/convert`, protected: true, handle: convert },
];
