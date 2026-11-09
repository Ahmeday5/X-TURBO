import { VoucherKind, VoucherPayload, VoucherStats, VoucherSummary } from '../../features/vouchers/models/voucher.model';
import { VOUCHERS_ENDPOINTS } from '../../features/vouchers/services/vouchers.service';
import { actorName, findOr404, inRange, round2, todayIso } from '../db/db-utils';
import {
  cancelVoucher,
  createVoucher,
  deleteVoucher,
  postVoucher,
  toVoucherSummary,
  updateVoucher,
  voucherRows,
} from '../db/vouchers.db';
import { bodyOf, CollectionOptions, filterCollection, queryCollection } from '../mock-collection';
import { MockContext, MockRoute, ok } from '../mock-http';

const LIST_OPTIONS: CollectionOptions<VoucherSummary> = {
  searchFields: ['number', 'description', 'reference', 'partyName', 'accountName', 'cashAccountName', 'createdBy'],
  filters: {
    kind: (row, v) => row.kind === (v as VoucherKind),
    status: (row, v) => row.status === v,
    partyId: (row, v) => row.partyId === v,
    cashAccountId: (row, v) => row.cashAccountId === v,
    method: (row, v) => row.method === v,
    costCenterId: (row, v) => row.costCenterId === v,
  },
};

function filtered(query: URLSearchParams): VoucherSummary[] {
  const from = query.get('from');
  const to = query.get('to');
  return voucherRows()
    .filter((v) => inRange(v.date, from, to))
    .map(toVoucherSummary);
}

function list({ query }: MockContext) {
  if (!query.get('sortBy')) {
    query.set('sortBy', 'date');
    query.set('sortDir', 'desc');
  }
  return ok(queryCollection(filtered(query), query, LIST_OPTIONS));
}

function stats({ query }: MockContext) {
  const q = new URLSearchParams(query);
  q.delete('status');
  const rows = filterCollection(filtered(q), q, LIST_OPTIONS);
  const live = rows.filter((r) => r.status !== 'cancelled');
  const month = todayIso().slice(0, 7);
  const result: VoucherStats = {
    count: rows.length,
    draft: rows.filter((r) => r.status === 'draft').length,
    posted: rows.filter((r) => r.status === 'posted').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    total: round2(live.reduce((s, r) => s + r.amount, 0)),
    thisMonth: round2(live.filter((r) => r.date.startsWith(month)).reduce((s, r) => s + r.amount, 0)),
  };
  return ok(result);
}

function get({ params, req }: MockContext) {
  return ok(findOr404(voucherRows(), params['id'], req.url, 'السند'));
}

function create({ req, userId }: MockContext) {
  return ok(createVoucher(bodyOf<VoucherPayload>(req.body), actorName(userId), req.url), 201);
}

function update({ params, req }: MockContext) {
  return ok(updateVoucher(params['id'], bodyOf<VoucherPayload>(req.body), req.url));
}

function remove({ params, req }: MockContext) {
  deleteVoucher(params['id'], req.url);
  return ok(null);
}

function post({ params, req }: MockContext) {
  return ok(postVoucher(params['id'], req.url));
}

function cancel({ params, req }: MockContext) {
  return ok(cancelVoucher(params['id'], bodyOf<{ reason?: string }>(req.body).reason ?? '', req.url));
}

const BY_ID = 'vouchers/:id';

export const VOUCHERS_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: VOUCHERS_ENDPOINTS.stats, protected: true, handle: stats },
  { method: 'GET', path: VOUCHERS_ENDPOINTS.list, protected: true, handle: list },
  { method: 'POST', path: VOUCHERS_ENDPOINTS.list, protected: true, handle: create },
  { method: 'GET', path: BY_ID, protected: true, handle: get },
  { method: 'PUT', path: BY_ID, protected: true, handle: update },
  { method: 'DELETE', path: BY_ID, protected: true, handle: remove },
  { method: 'POST', path: `${BY_ID}/post`, protected: true, handle: post },
  { method: 'POST', path: `${BY_ID}/cancel`, protected: true, handle: cancel },
];
