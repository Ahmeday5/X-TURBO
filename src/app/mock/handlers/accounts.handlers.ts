import { Account, AccountOption, AccountPayload, ACCOUNT_TYPE_VIEW, ACCOUNT_TYPES } from '../../features/accounts/models/account.model';
import { CostCenter, CostCenterOption, CostCenterPayload } from '../../features/accounts/models/cost-center.model';
import { accountRows, AccountRecord, nextAccountCode } from '../db/accounts.db';
import { costCenterRows, CostCenterRecord, nextCostCenterNo } from '../db/cost-centers.db';
import { actorName, findOr404, round2 } from '../db/db-utils';
import { accountTotals, glPostings } from '../db/ledger.db';
import { voucherRows } from '../db/vouchers.db';
import { bodyOf, filterCollection, queryCollection } from '../mock-collection';
import { fail, MockContext, MockRoute, ok } from '../mock-http';
import { API_ENDPOINTS } from '../../core/constants/api-endpoints.const';

// ── Accounts ──

/** Every account with balances rolled up the tree, ordered by code. */
export function accountsWithBalances(asOf?: string): Account[] {
  const rows = accountRows();
  const totals = accountTotals(asOf);
  // Signed debit-minus-credit per node, leaves first (longest code first), then roll up.
  const signed = new Map<string, { debit: number; credit: number; net: number }>();
  for (const a of rows) {
    const t = totals.get(a.id) ?? { debit: 0, credit: 0 };
    const openingSigned = a.nature === 'debit' ? a.openingBalance : -a.openingBalance;
    signed.set(a.id, { debit: t.debit, credit: t.credit, net: openingSigned + t.debit - t.credit });
  }
  for (const a of [...rows].sort((x, y) => y.level - x.level)) {
    if (!a.parentId) continue;
    const child = signed.get(a.id)!;
    const parent = signed.get(a.parentId)!;
    parent.debit += child.debit;
    parent.credit += child.credit;
    parent.net += child.net;
  }
  return [...rows]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => {
      const s = signed.get(a.id)!;
      return {
        ...a,
        parentName: a.parentId ? (rows.find((p) => p.id === a.parentId)?.name ?? null) : null,
        balance: round2(a.nature === 'debit' ? s.net : -s.net),
        totalDebit: round2(s.debit),
        totalCredit: round2(s.credit),
        childrenCount: rows.filter((c) => c.parentId === a.id).length,
      };
    });
}

function listAccounts({ query }: MockContext) {
  return ok(accountsWithBalances(query.get('asOf') ?? undefined));
}

function lookupAccounts({ query }: MockContext) {
  const leaf = query.get('leaf') === '1';
  const group = query.get('group') === '1';
  const type = query.get('type');
  const options: AccountOption[] = [...accountRows()]
    .filter((a) => a.isActive && (!leaf || !a.isGroup) && (!group || a.isGroup) && (!type || a.type === type))
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(({ id, code, name, type: t, isGroup, level, costCenterRequired }) => ({ id, code, name, type: t, isGroup, level, costCenterRequired }));
  return ok(options);
}

function getAccount({ params, req }: MockContext) {
  findOr404(accountRows(), params['id'], req.url, 'الحساب');
  return ok(accountsWithBalances().find((a) => a.id === params['id']));
}

function createAccount({ req }: MockContext) {
  const payload = validAccount(bodyOf<AccountPayload>(req.body), req.url);
  const parent = payload.parentId ? accountRows().find((a) => a.id === payload.parentId)! : null;
  const code = nextAccountCode(payload.parentId);
  const row: AccountRecord = {
    ...payload,
    id: `acc-${code}`,
    code,
    level: parent ? parent.level + 1 : 1,
    isSystem: false,
    createdAt: new Date().toISOString(),
  };
  accountRows().push(row);
  return ok(accountsWithBalances().find((a) => a.id === row.id), 201);
}

function updateAccount({ params, req }: MockContext) {
  const row = findOr404(accountRows(), params['id'], req.url, 'الحساب');
  const payload = validAccount(bodyOf<AccountPayload>(req.body), req.url, row);
  if (payload.parentId !== row.parentId) throw fail(409, 'لا يمكن نقل الحساب إلى أب آخر بعد إنشائه', req.url);
  if (row.isSystem && (payload.isGroup !== row.isGroup || !payload.isActive)) {
    throw fail(409, 'حساب نظامي — لا يمكن إيقافه أو تغيير نوعه', req.url);
  }
  if (payload.isGroup && !row.isGroup && isPosted(row.id)) throw fail(409, 'لا يمكن تحويل حساب عليه قيود إلى حساب تجميعي', req.url);
  if (!payload.isGroup && row.isGroup && accountRows().some((a) => a.parentId === row.id)) {
    throw fail(409, 'لا يمكن تحويل حساب له حسابات فرعية إلى حساب فرعي', req.url);
  }
  Object.assign(row, payload);
  return ok(accountsWithBalances().find((a) => a.id === row.id));
}

function deleteAccount({ params, req }: MockContext) {
  const rows = accountRows();
  const row = findOr404(rows, params['id'], req.url, 'الحساب');
  if (row.isSystem) throw fail(409, 'حساب نظامي — لا يمكن حذفه', req.url);
  if (rows.some((a) => a.parentId === row.id)) throw fail(409, 'احذف الحسابات الفرعية أولًا', req.url);
  if (isPosted(row.id) || row.openingBalance) throw fail(409, 'لا يمكن حذف حساب عليه قيود أو رصيد — أوقفه بدلًا من ذلك', req.url);
  rows.splice(rows.indexOf(row), 1);
  return ok(null);
}

function isPosted(accountId: string): boolean {
  return glPostings().some((p) => p.accountId === accountId) || voucherRows().some((v) => v.accountId === accountId || v.lines.some((l) => l.accountId === accountId));
}

function validAccount(p: AccountPayload, url: string, self?: AccountRecord): AccountPayload {
  const name = p.name?.trim();
  if (!name) throw fail(422, 'اسم الحساب مطلوب', url);
  const parent = p.parentId ? findOr404(accountRows(), p.parentId, url, 'الحساب الرئيسي') : null;
  if (parent && !parent.isGroup) throw fail(422, 'الحساب الرئيسي يجب أن يكون حسابًا تجميعيًا', url);
  const type = parent ? parent.type : p.type;
  if (!ACCOUNT_TYPES.includes(type)) throw fail(422, 'نوع الحساب غير صحيح', url);
  if (accountRows().some((a) => a.name === name && a.parentId === (parent?.id ?? null) && a.id !== self?.id)) {
    throw fail(409, 'يوجد حساب بنفس الاسم تحت نفس الحساب الرئيسي', url);
  }
  return {
    ...p,
    name,
    parentId: parent?.id ?? null,
    type,
    nature: p.nature === 'debit' || p.nature === 'credit' ? p.nature : ACCOUNT_TYPE_VIEW[type].nature,
    currency: p.currency || 'EGP',
    openingBalance: p.isGroup ? 0 : round2(Number(p.openingBalance) || 0),
    costCenterRequired: !p.isGroup && !!p.costCenterRequired,
    notes: (p.notes ?? '').trim(),
  };
}

// ── Cost centers ──

function withCenterStats(rows: readonly CostCenterRecord[]): CostCenter[] {
  const year = String(new Date().getFullYear());
  const types = new Map(accountRows().map((a) => [a.id, a.type]));
  const postings = glPostings().filter((p) => p.costCenterId && p.date.startsWith(year));
  return rows.map((c) => {
    const mine = postings.filter((p) => p.costCenterId === c.id);
    return {
      ...c,
      parentName: c.parentId ? (costCenterRows().find((p) => p.id === c.parentId)?.name ?? null) : null,
      actualSpend: round2(mine.filter((p) => types.get(p.accountId) === 'expense').reduce((s, p) => s + p.debit - p.credit, 0)),
      actualRevenue: round2(mine.filter((p) => types.get(p.accountId) === 'revenue').reduce((s, p) => s + p.credit - p.debit, 0)),
      postingsCount: mine.length,
    };
  });
}

function listCenters({ query }: MockContext) {
  return ok(
    queryCollection(withCenterStats(costCenterRows()), query, {
      searchFields: ['name', 'code', 'manager'],
      filters: { status: (row, v) => (v === 'active' ? row.isActive : !row.isActive) },
    }),
  );
}

function lookupCenters() {
  const options: CostCenterOption[] = costCenterRows()
    .filter((c) => c.isActive)
    .map(({ id, code, name, color }) => ({ id, code, name, color }));
  return ok(options);
}

function getCenter({ params, req }: MockContext) {
  const row = findOr404(costCenterRows(), params['id'], req.url, 'مركز التكلفة');
  return ok(withCenterStats([row])[0]);
}

function createCenter({ req }: MockContext) {
  const payload = validCenter(bodyOf<CostCenterPayload>(req.body), req.url);
  const n = nextCostCenterNo();
  const row: CostCenterRecord = { ...payload, id: `cc-${n}`, code: `CC-${String(n).padStart(2, '0')}`, createdAt: new Date().toISOString() };
  costCenterRows().push(row);
  return ok(withCenterStats([row])[0], 201);
}

function updateCenter({ params, req }: MockContext) {
  const row = findOr404(costCenterRows(), params['id'], req.url, 'مركز التكلفة');
  const payload = validCenter(bodyOf<CostCenterPayload>(req.body), req.url, row.id);
  if (payload.parentId === row.id) throw fail(422, 'لا يمكن أن يكون المركز أبًا لنفسه', req.url);
  Object.assign(row, payload);
  return ok(withCenterStats([row])[0]);
}

function deleteCenter({ params, req }: MockContext) {
  const rows = costCenterRows();
  const row = findOr404(rows, params['id'], req.url, 'مركز التكلفة');
  if (glPostings().some((p) => p.costCenterId === row.id)) throw fail(409, 'لا يمكن حذف مركز عليه قيود — أوقفه بدلًا من ذلك', req.url);
  if (rows.some((c) => c.parentId === row.id)) throw fail(409, 'احذف المراكز الفرعية أولًا', req.url);
  rows.splice(rows.indexOf(row), 1);
  return ok(null);
}

function validCenter(p: CostCenterPayload, url: string, selfId?: string): CostCenterPayload {
  const name = p.name?.trim();
  if (!name) throw fail(422, 'اسم مركز التكلفة مطلوب', url);
  if (costCenterRows().some((c) => c.name === name && c.id !== selfId)) throw fail(409, 'يوجد مركز تكلفة بنفس الاسم', url);
  if (p.parentId) findOr404(costCenterRows(), p.parentId, url, 'المركز الرئيسي');
  return {
    ...p,
    name,
    parentId: p.parentId || null,
    manager: (p.manager ?? '').trim(),
    notes: (p.notes ?? '').trim(),
    annualBudget: Math.max(0, Number(p.annualBudget) || 0),
  };
}

const ACCOUNT_BY_ID = 'accounts/:id';
const CENTER_BY_ID = 'cost-centers/:id';

export const ACCOUNTS_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: API_ENDPOINTS.accounts.lookup, protected: true, handle: lookupAccounts },
  { method: 'GET', path: API_ENDPOINTS.accounts.list, protected: true, handle: listAccounts },
  { method: 'POST', path: API_ENDPOINTS.accounts.list, protected: true, handle: createAccount },
  { method: 'GET', path: ACCOUNT_BY_ID, protected: true, handle: getAccount },
  { method: 'PUT', path: ACCOUNT_BY_ID, protected: true, handle: updateAccount },
  { method: 'DELETE', path: ACCOUNT_BY_ID, protected: true, handle: deleteAccount },

  { method: 'GET', path: API_ENDPOINTS.costCenters.lookup, protected: true, handle: lookupCenters },
  { method: 'GET', path: API_ENDPOINTS.costCenters.list, protected: true, handle: listCenters },
  { method: 'POST', path: API_ENDPOINTS.costCenters.list, protected: true, handle: createCenter },
  { method: 'GET', path: CENTER_BY_ID, protected: true, handle: getCenter },
  { method: 'PUT', path: CENTER_BY_ID, protected: true, handle: updateCenter },
  { method: 'DELETE', path: CENTER_BY_ID, protected: true, handle: deleteCenter },
];
