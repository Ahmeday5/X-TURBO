import { Account, AccountOption, AccountPayload, ACCOUNT_TYPE_VIEW, ACCOUNT_TYPES } from '../../features/accounts/models/account.model';
import { CostCenter, CostCenterOption, CostCenterPayload } from '../../features/accounts/models/cost-center.model';
import { ACCOUNTS_ENDPOINTS } from '../../features/accounts/services/accounts.service';
import { COST_CENTERS_ENDPOINTS } from '../../features/accounts/services/cost-centers.service';
import { accountRows, AccountRecord, nextAccountCode } from '../db/accounts.db';
import { costCenterRows, CostCenterRecord, nextCostCenterNo } from '../db/cost-centers.db';
import { actorName, findOr404, round2 } from '../db/db-utils';
import { accountTotals, glPostings } from '../db/ledger.db';
import { voucherRows } from '../db/vouchers.db';
import { bodyOf, filterCollection, queryCollection } from '../mock-collection';
import { fail, MockContext, MockRoute, ok } from '../mock-http';
import { Budget, BudgetLine, BudgetPayload } from '../../features/accounts/models/budget.model';
import { Currency, CurrencyPayload } from '../../features/accounts/models/currency.model';
import { Employee, EmployeePayload, EmployeeStats, EMPLOYEE_STATUSES } from '../../features/accounts/models/employee.model';
import { BUDGET_ENDPOINTS } from '../../features/accounts/services/budget.service';
import { CURRENCIES_ENDPOINTS } from '../../features/accounts/services/currencies.service';
import { EMPLOYEES_ENDPOINTS } from '../../features/accounts/services/employees.service';
import { budgetPlan, saveBudgetPlan } from '../db/budget.db';
import { currencyRows, CurrencyRecord, HISTORY_LENGTH, round4 } from '../db/currencies.db';
import { employeeRows, EmployeeRecord, nextEmployeeNo } from '../db/employees.db';

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
  if (employeeRows().some((e) => e.advancesAccountId === row.id)) throw fail(409, 'الحساب مرتبط بسلف موظفين — فك الربط أولًا', req.url);
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
  if (employeeRows().some((e) => e.costCenterId === row.id)) throw fail(409, 'يوجد موظفون تابعون لهذا المركز — انقلهم أولًا', req.url);
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

// ── Employees ──

const PHONE = /^01[0125]\d{8}$/;

function toEmployee(e: EmployeeRecord): Employee {
  const cc = e.costCenterId ? costCenterRows().find((c) => c.id === e.costCenterId) : undefined;
  const acc = e.advancesAccountId ? accountRows().find((a) => a.id === e.advancesAccountId) : undefined;
  return {
    ...e,
    costCenterName: cc?.name ?? null,
    costCenterColor: cc?.color ?? null,
    advancesAccountName: acc?.name ?? null,
  };
}

const EMPLOYEE_OPTIONS = {
  searchFields: ['name', 'code', 'jobTitle', 'phone', 'costCenterName', 'nationalId'] as (keyof Employee)[],
  filters: {
    costCenterId: (row: Employee, v: string) => row.costCenterId === v,
    status: (row: Employee, v: string) => row.status === v,
  },
};

function listEmployees({ query }: MockContext) {
  return ok(queryCollection(employeeRows().map(toEmployee), query, EMPLOYEE_OPTIONS));
}

function employeeStats({ query }: MockContext) {
  const q = new URLSearchParams(query);
  q.delete('status');
  const rows = filterCollection(employeeRows().map(toEmployee), q, EMPLOYEE_OPTIONS);
  const paid = rows.filter((e) => e.status !== 'terminated');
  const byDept = new Map<string, EmployeeStats['byDepartment'][number]>();
  for (const e of paid) {
    const k = e.costCenterId ?? 'none';
    const row = byDept.get(k) ?? { costCenterId: e.costCenterId, name: e.costCenterName ?? 'بدون قسم', color: e.costCenterColor ?? 'var(--txt3)', count: 0, salaries: 0 };
    row.count++;
    row.salaries += e.salary;
    byDept.set(k, row);
  }
  const totalSalaries = paid.reduce((s, e) => s + e.salary, 0);
  const stats: EmployeeStats = {
    headcount: paid.length,
    active: rows.filter((e) => e.status === 'active').length,
    onLeave: rows.filter((e) => e.status === 'leave').length,
    totalSalaries,
    averageSalary: paid.length ? Math.round(totalSalaries / paid.length) : 0,
    byDepartment: [...byDept.values()].sort((a, b) => b.salaries - a.salaries),
  };
  return ok(stats);
}

function createEmployee({ req }: MockContext) {
  const payload = validEmployee(bodyOf<EmployeePayload>(req.body), req.url);
  const n = nextEmployeeNo();
  const row: EmployeeRecord = { ...payload, id: `emp-${n}`, code: `EMP-${String(n).padStart(4, '0')}`, createdAt: new Date().toISOString() };
  employeeRows().unshift(row);
  return ok(toEmployee(row), 201);
}

function updateEmployee({ params, req }: MockContext) {
  const row = findOr404(employeeRows(), params['id'], req.url, 'الموظف');
  Object.assign(row, validEmployee(bodyOf<EmployeePayload>(req.body), req.url, row.id));
  return ok(toEmployee(row));
}

function deleteEmployee({ params, req }: MockContext) {
  const rows = employeeRows();
  const row = findOr404(rows, params['id'], req.url, 'الموظف');
  if (row.status !== 'terminated') throw fail(409, 'أنهِ خدمة الموظف أولًا — لا يُحذف موظف على رأس العمل', req.url);
  rows.splice(rows.indexOf(row), 1);
  return ok(null);
}

function validEmployee(p: EmployeePayload, url: string, selfId?: string): Omit<EmployeeRecord, 'id' | 'code' | 'createdAt'> {
  const name = p.name?.trim();
  if (!name || name.length < 3) throw fail(422, 'اسم الموظف مطلوب', url);
  if (!EMPLOYEE_STATUSES.includes(p.status)) throw fail(422, 'حالة الموظف غير صحيحة', url);
  const phone = (p.phone ?? '').replace(/\s+/g, '');
  if (phone && !PHONE.test(phone)) throw fail(422, 'رقم الموبايل غير صحيح', url);
  const nationalId = (p.nationalId ?? '').trim();
  if (nationalId && !/^\d{14}$/.test(nationalId)) throw fail(422, 'الرقم القومي يجب أن يكون 14 رقمًا', url);
  if (nationalId && employeeRows().some((e) => e.nationalId === nationalId && e.id !== selfId)) {
    throw fail(409, 'الرقم القومي مسجل لموظف آخر', url);
  }
  if (p.costCenterId) findOr404(costCenterRows(), p.costCenterId, url, 'القسم');
  if (p.advancesAccountId) {
    const acc = findOr404(accountRows(), p.advancesAccountId, url, 'حساب السلف');
    if (acc.isGroup) throw fail(422, 'اختر حسابًا فرعيًا للسلف', url);
  }
  if (!p.hireDate) throw fail(422, 'تاريخ التعيين مطلوب', url);
  return {
    name,
    jobTitle: (p.jobTitle ?? '').trim(),
    costCenterId: p.costCenterId || null,
    phone,
    nationalId,
    hireDate: p.hireDate,
    salary: Math.max(0, Math.round(Number(p.salary) || 0)),
    advancesAccountId: p.advancesAccountId || null,
    status: p.status,
    notes: (p.notes ?? '').trim(),
  };
}

// ── Budget ──

function budgetOf(year: number, costCenterId: string | null): Budget {
  const plan = budgetPlan(year, costCenterId);
  const leaves = [...accountRows()]
    .filter((a) => !a.isGroup && (a.type === 'revenue' || a.type === 'expense') && (a.isActive || plan.lines.has(a.id)))
    .sort((a, b) => a.code.localeCompare(b.code));

  const actual = new Map<string, number[]>(leaves.map((a) => [a.id, Array(12).fill(0)]));
  const prefix = `${year}-`;
  for (const p of glPostings()) {
    if (!p.date.startsWith(prefix) || (costCenterId && p.costCenterId !== costCenterId)) continue;
    const row = actual.get(p.accountId);
    if (!row) continue;
    const month = Number(p.date.slice(5, 7)) - 1;
    row[month] += p.debit - p.credit;
  }

  const lines: BudgetLine[] = leaves.map((a) => {
    const sign = a.type === 'revenue' ? -1 : 1;
    return {
      accountId: a.id,
      accountCode: a.code,
      accountName: a.name,
      type: a.type as BudgetLine['type'],
      planned: plan.lines.get(a.id) ?? Array(12).fill(0),
      actual: actual.get(a.id)!.map((v) => round2(v * sign)),
    };
  });
  return { year, costCenterId, lines, updatedAt: plan.updatedAt, updatedBy: plan.updatedBy };
}

function parseYear(raw: string | null | undefined, url: string): number {
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw fail(422, 'السنة غير صحيحة', url);
  return year;
}

function getBudget({ query, req }: MockContext) {
  const costCenterId = query.get('costCenterId') || null;
  if (costCenterId) findOr404(costCenterRows(), costCenterId, req.url, 'مركز التكلفة');
  return ok(budgetOf(parseYear(query.get('year') ?? String(new Date().getFullYear()), req.url), costCenterId));
}

function saveBudget({ params, req, userId }: MockContext) {
  const year = parseYear(params['year'], req.url);
  const body = bodyOf<BudgetPayload>(req.body);
  const costCenterId = body.costCenterId || null;
  if (costCenterId) findOr404(costCenterRows(), costCenterId, req.url, 'مركز التكلفة');
  const lines = new Map<string, number[]>();
  for (const l of body.lines ?? []) {
    const acc = findOr404(accountRows(), l.accountId, req.url, 'الحساب');
    if (acc.isGroup || (acc.type !== 'revenue' && acc.type !== 'expense')) throw fail(422, `«${acc.name}» لا يُضاف إلى الموازنة`, req.url);
    if (!Array.isArray(l.planned) || l.planned.length !== 12) throw fail(422, 'يجب إدخال 12 شهرًا لكل حساب', req.url);
    lines.set(acc.id, l.planned.map((v) => round2(Number(v) || 0)));
  }
  saveBudgetPlan(year, costCenterId, lines, actorName(userId));
  return ok(budgetOf(year, costCenterId));
}

// ── Currencies ──

function toCurrency(c: CurrencyRecord): Currency {
  const rate = c.history[c.history.length - 1];
  const previousRate = c.history[c.history.length - 2] ?? rate;
  return {
    ...c,
    rate,
    previousRate,
    changePct: previousRate ? Math.round(((rate - previousRate) / previousRate) * 10_000) / 100 : 0,
  };
}

function listCurrencies() {
  return ok([...currencyRows()].sort((a, b) => Number(b.isBase) - Number(a.isBase)).map(toCurrency));
}

function createCurrency({ req, userId }: MockContext) {
  const p = validCurrency(bodyOf<CurrencyPayload>(req.body), req.url);
  const row: CurrencyRecord = {
    id: `cur-${p.code.toLowerCase()}`,
    code: p.code,
    name: p.name,
    symbol: p.symbol,
    isBase: false,
    isActive: p.isActive,
    history: [p.rate],
    updatedAt: new Date().toISOString(),
    updatedBy: actorName(userId),
  };
  currencyRows().push(row);
  return ok(toCurrency(row), 201);
}

function updateCurrency({ params, req, userId }: MockContext) {
  const row = findOr404(currencyRows(), params['id'], req.url, 'العملة');
  const p = validCurrency(bodyOf<CurrencyPayload>(req.body), req.url, row.id);
  if (row.isBase && (p.rate !== 1 || p.code !== row.code || !p.isActive)) {
    throw fail(409, 'العملة الأساسية ثابتة — سعرها 1 ولا يمكن إيقافها', req.url);
  }
  Object.assign(row, { code: p.code, name: p.name, symbol: p.symbol, isActive: p.isActive });
  if (!row.isBase && p.rate !== row.history[row.history.length - 1]) {
    row.history = [...row.history, p.rate].slice(-HISTORY_LENGTH);
    row.updatedAt = new Date().toISOString();
    row.updatedBy = actorName(userId);
  }
  return ok(toCurrency(row));
}

function deleteCurrency({ params, req }: MockContext) {
  const rows = currencyRows();
  const row = findOr404(rows, params['id'], req.url, 'العملة');
  if (row.isBase) throw fail(409, 'لا يمكن حذف العملة الأساسية', req.url);
  if (accountRows().some((a) => a.currency === row.code)) throw fail(409, 'العملة مستخدمة في حسابات — أوقفها بدلًا من ذلك', req.url);
  rows.splice(rows.indexOf(row), 1);
  return ok(null);
}

function validCurrency(p: CurrencyPayload, url: string, selfId?: string): CurrencyPayload {
  const code = (p.code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw fail(422, 'رمز العملة 3 حروف لاتينية (مثل USD)', url);
  if (currencyRows().some((c) => c.code === code && c.id !== selfId)) throw fail(409, 'العملة مضافة بالفعل', url);
  const name = (p.name ?? '').trim();
  if (!name) throw fail(422, 'اسم العملة مطلوب', url);
  const rate = round4(Number(p.rate));
  if (!(rate > 0)) throw fail(422, 'سعر الصرف يجب أن يكون أكبر من صفر', url);
  return { code, name, symbol: (p.symbol ?? '').trim() || code, rate, isActive: !!p.isActive };
}

const ACCOUNT_BY_ID = 'accounts/:id';
const CENTER_BY_ID = 'cost-centers/:id';

export const ACCOUNTS_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: ACCOUNTS_ENDPOINTS.lookup, protected: true, handle: lookupAccounts },
  { method: 'GET', path: ACCOUNTS_ENDPOINTS.list, protected: true, handle: listAccounts },
  { method: 'POST', path: ACCOUNTS_ENDPOINTS.list, protected: true, handle: createAccount },
  { method: 'GET', path: ACCOUNT_BY_ID, protected: true, handle: getAccount },
  { method: 'PUT', path: ACCOUNT_BY_ID, protected: true, handle: updateAccount },
  { method: 'DELETE', path: ACCOUNT_BY_ID, protected: true, handle: deleteAccount },

  { method: 'GET', path: COST_CENTERS_ENDPOINTS.lookup, protected: true, handle: lookupCenters },
  { method: 'GET', path: COST_CENTERS_ENDPOINTS.list, protected: true, handle: listCenters },
  { method: 'POST', path: COST_CENTERS_ENDPOINTS.list, protected: true, handle: createCenter },
  { method: 'PUT', path: CENTER_BY_ID, protected: true, handle: updateCenter },
  { method: 'DELETE', path: CENTER_BY_ID, protected: true, handle: deleteCenter },

  { method: 'GET', path: EMPLOYEES_ENDPOINTS.stats, protected: true, handle: employeeStats },
  { method: 'GET', path: EMPLOYEES_ENDPOINTS.list, protected: true, handle: listEmployees },
  { method: 'POST', path: EMPLOYEES_ENDPOINTS.list, protected: true, handle: createEmployee },
  { method: 'PUT', path: 'employees/:id', protected: true, handle: updateEmployee },
  { method: 'DELETE', path: 'employees/:id', protected: true, handle: deleteEmployee },

  { method: 'GET', path: BUDGET_ENDPOINTS.get, protected: true, handle: getBudget },
  { method: 'PUT', path: 'budget/:year', protected: true, handle: saveBudget },

  { method: 'GET', path: CURRENCIES_ENDPOINTS.list, protected: true, handle: listCurrencies },
  { method: 'POST', path: CURRENCIES_ENDPOINTS.list, protected: true, handle: createCurrency },
  { method: 'PUT', path: 'currencies/:id', protected: true, handle: updateCurrency },
  { method: 'DELETE', path: 'currencies/:id', protected: true, handle: deleteCurrency },
];
