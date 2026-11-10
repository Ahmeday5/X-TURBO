import {
  balanceSide,
  DetailedStatementEntry,
  Party,
  PartyBalanceRow,
  PartyBalancesSummary,
  partyFits,
  PartyOption,
  PartyPayload,
  PARTY_KINDS,
  PartyStatement,
} from '../../features/parties/models/party.model';
import { findOr404, round2, todayIso } from '../db/db-utils';
import { documentRows } from '../db/documents.db';
import { allPartyBalances, partyEntries } from '../db/ledger.db';
import { newPartyId, nextPartyCode, partyRows, PartyRecord } from '../db/parties.db';
import { voucherRows } from '../db/vouchers.db';
import { bodyOf, CollectionOptions, filterCollection, queryCollection } from '../mock-collection';
import { fail, MockContext, MockRoute, ok } from '../mock-http';
import { API_ENDPOINTS } from '../../core/constants/api-endpoints.const';

const PHONE = /^01[0125]\d{8}$/;

function withBalances(rows: readonly PartyRecord[]): Party[] {
  const balances = allPartyBalances();
  return rows.map((p) => {
    const b = balances.get(p.id);
    return { ...p, balance: b?.balance ?? p.openingBalance, lastMovementAt: b?.last ?? null };
  });
}

function toOption(p: Party): PartyOption {
  return { id: p.id, code: p.code, name: p.name, kind: p.kind, phone: p.phone, balance: p.balance, creditLimit: p.creditLimit };
}

// ── CRUD ──

function list({ query }: MockContext) {
  return ok(
    queryCollection(withBalances(partyRows()), query, {
      searchFields: ['name', 'code', 'phone', 'phone2', 'email', 'city', 'taxNumber'],
      filters: {
        kind: (row, v) => (v === 'customer' || v === 'supplier' ? partyFits(row.kind, v) : row.kind === v),
        status: (row, v) => (v === 'active' ? row.isActive : !row.isActive),
        external: (row, v) => row.isExternal === (v === '1'),
        balance: (row, v) => balanceSide(row.balance) === v,
      },
    }),
  );
}

function lookup({ query }: MockContext) {
  const role = query.get('role') as 'customer' | 'supplier' | null;
  const rows = withBalances(partyRows().filter((p) => p.isActive && (!role || partyFits(p.kind, role))));
  return ok(rows.map(toOption));
}

function get({ params, req }: MockContext) {
  return ok(withBalances([findOr404(partyRows(), params['id'], req.url, 'الحساب')])[0]);
}

function create({ req }: MockContext) {
  const payload = valid(bodyOf<PartyPayload>(req.body), req.url);
  const row: PartyRecord = {
    ...payload,
    id: newPartyId(),
    code: nextPartyCode(payload.kind),
    createdAt: new Date().toISOString(),
  };
  partyRows().unshift(row);
  return ok(withBalances([row])[0], 201);
}

function update({ params, req }: MockContext) {
  const row = findOr404(partyRows(), params['id'], req.url, 'الحساب');
  const payload = valid(bodyOf<PartyPayload>(req.body), req.url, row.id);
  const used = isUsed(row.id);
  if (used && payload.kind !== row.kind && payload.kind !== 'both') {
    throw fail(409, 'لا يمكن تغيير النوع لحساب عليه حركات — يمكنك جعله «عميل ومورد»', req.url);
  }
  if (used && payload.openingBalance !== row.openingBalance) {
    throw fail(409, 'لا يمكن تعديل الرصيد الافتتاحي لحساب عليه حركات — استخدم سند قيد للتسوية', req.url);
  }
  Object.assign(row, payload);
  for (const d of documentRows()) if (d.partyId === row.id) d.partyName = row.name;
  for (const v of voucherRows()) if (v.partyId === row.id) v.partyName = row.name;
  return ok(withBalances([row])[0]);
}

function remove({ params, req }: MockContext) {
  const rows = partyRows();
  const row = findOr404(rows, params['id'], req.url, 'الحساب');
  if (isUsed(row.id)) throw fail(409, 'لا يمكن حذف حساب عليه حركات — أوقفه بدلًا من ذلك', req.url);
  rows.splice(rows.indexOf(row), 1);
  return ok(null);
}

function isUsed(partyId: string): boolean {
  return documentRows().some((d) => d.partyId === partyId) || voucherRows().some((v) => v.partyId === partyId);
}

function valid(p: PartyPayload, url: string, selfId?: string): PartyPayload {
  const name = p.name?.trim();
  if (!name || name.length < 2) throw fail(422, 'الاسم مطلوب', url);
  if (!PARTY_KINDS.includes(p.kind)) throw fail(422, 'النوع غير صحيح', url);
  const phone = (p.phone ?? '').replace(/\s+/g, '');
  if (phone && !PHONE.test(phone)) throw fail(422, 'رقم الموبايل غير صحيح', url);
  if (phone && partyRows().some((x) => x.phone === phone && x.id !== selfId)) {
    throw fail(409, 'رقم الموبايل مسجل لحساب آخر', url);
  }
  return {
    ...p,
    name,
    phone,
    phone2: (p.phone2 ?? '').replace(/\s+/g, ''),
    email: (p.email ?? '').trim(),
    city: (p.city ?? '').trim(),
    address: (p.address ?? '').trim(),
    taxNumber: (p.taxNumber ?? '').trim(),
    commercialRegister: (p.commercialRegister ?? '').trim(),
    notes: (p.notes ?? '').trim(),
    creditLimit: Math.max(0, Number(p.creditLimit) || 0),
    paymentTermDays: Math.max(0, Math.round(Number(p.paymentTermDays) || 0)),
    openingBalance: round2(Number(p.openingBalance) || 0),
    priceList: p.priceList === 'wholesale' ? 'wholesale' : 'retail',
    isExternal: !!p.isExternal,
  };
}

// ── Statements ──

function statementOf(id: string, query: URLSearchParams, url: string, detailed: boolean): PartyStatement<DetailedStatementEntry> {
  const party = withBalances([findOr404(partyRows(), id, url, 'الحساب')])[0];
  const from = query.get('from') || '';
  const to = query.get('to') || todayIso();
  if (from && from > to) throw fail(422, 'تاريخ البداية بعد تاريخ النهاية', url);

  const all = partyEntries(id);
  const opening = round2(all.filter((e) => from && e.date < from).reduce((b, e) => b + e.debit - e.credit, party.openingBalance));
  let running = opening;
  const entries = all
    .filter((e) => (!from || e.date >= from) && e.date <= to)
    .map((e) => {
      running = round2(running + e.debit - e.credit);
      const { partyId: _p, at: _a, lines, ...rest } = e;
      return { ...rest, balance: running, lines: detailed ? lines : [] };
    });

  const totalDebit = round2(entries.reduce((s, e) => s + e.debit, 0));
  const totalCredit = round2(entries.reduce((s, e) => s + e.credit, 0));
  return {
    party: toOption(party),
    from,
    to,
    openingBalance: opening,
    totalDebit,
    totalCredit,
    closingBalance: round2(opening + totalDebit - totalCredit),
    entries,
  };
}

function statement({ params, query, req }: MockContext) {
  const { entries, ...rest } = statementOf(params['id'], query, req.url, false);
  return ok({ ...rest, entries: entries.map(({ lines: _l, ...e }) => e) });
}

function statementDetailed({ params, query, req }: MockContext) {
  return ok(statementOf(params['id'], query, req.url, true));
}

// ── Balances ──

const BALANCE_OPTIONS: CollectionOptions<PartyBalanceRow> = {
  searchFields: ['name', 'code', 'phone'],
  filters: {
    kind: (row, v) => (v === 'customer' || v === 'supplier' ? partyFits(row.kind, v) : row.kind === v),
    side: (row, v) => balanceSide(row.balance) === v,
    overLimit: (row) => row.overLimit,
    hideZero: (row) => row.balance !== 0,
  },
};

function balanceRows(query: URLSearchParams): PartyBalanceRow[] {
  const asOf = query.get('asOf') || todayIso();
  const balances = allPartyBalances(asOf);
  return partyRows()
    .filter((p) => p.createdAt.slice(0, 10) <= asOf || balances.get(p.id)?.last)
    .map((p) => {
      const b = balances.get(p.id)!;
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        kind: p.kind,
        phone: p.phone,
        creditLimit: p.creditLimit,
        totalDebit: b.debit,
        totalCredit: b.credit,
        balance: b.balance,
        overLimit: p.creditLimit > 0 && b.balance > p.creditLimit,
        lastMovementAt: b.last,
      };
    });
}

function balances({ query }: MockContext) {
  if (!query.get('sortBy')) {
    query.set('sortBy', 'balance');
    query.set('sortDir', 'desc');
  }
  return ok(queryCollection(balanceRows(query), query, BALANCE_OPTIONS));
}

function balancesSummary({ query }: MockContext) {
  const rows = filterCollection(balanceRows(query), query, BALANCE_OPTIONS);
  const receivable = round2(rows.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0));
  const payable = round2(rows.filter((r) => r.balance < 0).reduce((s, r) => s - r.balance, 0));
  const summary: PartyBalancesSummary = {
    count: rows.length,
    receivable,
    payable,
    net: round2(receivable - payable),
    overLimitCount: rows.filter((r) => r.overLimit).length,
  };
  return ok(summary);
}

const BY_ID = 'parties/:id';

export const PARTIES_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: API_ENDPOINTS.parties.lookup, protected: true, handle: lookup },
  { method: 'GET', path: API_ENDPOINTS.parties.balancesSummary, protected: true, handle: balancesSummary },
  { method: 'GET', path: API_ENDPOINTS.parties.balances, protected: true, handle: balances },
  { method: 'GET', path: API_ENDPOINTS.parties.list, protected: true, handle: list },
  { method: 'POST', path: API_ENDPOINTS.parties.list, protected: true, handle: create },
  { method: 'GET', path: `${BY_ID}/statement/detailed`, protected: true, handle: statementDetailed },
  { method: 'GET', path: `${BY_ID}/statement`, protected: true, handle: statement },
  { method: 'GET', path: BY_ID, protected: true, handle: get },
  { method: 'PUT', path: BY_ID, protected: true, handle: update },
  { method: 'DELETE', path: BY_ID, protected: true, handle: remove },
];
