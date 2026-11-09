import { Account, ACCOUNT_TYPE_VIEW, AccountType } from '../../features/accounts/models/account.model';
import { daysAgo } from '../mock-utils';

/**
 * Chart of accounts. Balances are derived from ledger postings
 * (ledger.db.ts), never stored.
 */

export type AccountRecord = Omit<Account, 'balance' | 'totalDebit' | 'totalCredit' | 'childrenCount' | 'parentName'>;

interface AccountsDb {
  accounts: AccountRecord[];
}

/** [code, name, isGroup, openingBalance?] — parent is the longest code that prefixes it. */
const CHART: ReadonlyArray<[code: string, name: string, isGroup: boolean, opening?: number]> = [
  ['1', 'الأصول', true],
  ['11', 'الأصول المتداولة', true],
  ['1101', 'الصندوق الرئيسي', false, 185_000],
  ['1102', 'البنك الأهلي — حساب جاري', false, 1_240_000],
  ['1103', 'العملاء', false],
  ['1104', 'المخزون', false, 3_650_000],
  ['1105', 'خزينة نقطة البيع', false, 25_000],
  ['1106', 'سلف الموظفين', false, 18_000],
  ['12', 'الأصول الثابتة', true],
  ['1201', 'السيارات', false, 920_000],
  ['1202', 'الأثاث والتجهيزات', false, 340_000],
  ['1203', 'أجهزة الحاسب', false, 165_000],
  ['2', 'الخصوم', true],
  ['21', 'الخصوم المتداولة', true],
  ['2101', 'الموردون', false],
  ['2102', 'مصروفات مستحقة', false, 42_000],
  ['22', 'الضرائب', true],
  ['2201', 'ضريبة القيمة المضافة', false, 36_500],
  ['3', 'حقوق الملكية', true],
  ['3101', 'رأس المال', false, 5_000_000],
  ['3102', 'الأرباح المحتجزة', false, 1_464_500],
  ['4', 'الإيرادات', true],
  ['4101', 'المبيعات', false],
  ['4102', 'مردودات المبيعات', false],
  ['4103', 'إيرادات أخرى', false],
  ['5', 'المصروفات', true],
  ['51', 'تكلفة المبيعات', true],
  ['5101', 'تكلفة البضاعة المباعة', false],
  ['52', 'المصروفات التشغيلية', true],
  ['5201', 'الرواتب والأجور', false],
  ['5202', 'الإيجارات', false],
  ['5203', 'الكهرباء والمياه', false],
  ['5204', 'النقل والشحن', false],
  ['5205', 'الدعاية والتسويق', false],
  ['5206', 'صيانة وإصلاحات', false],
  ['5207', 'مصروفات بنكية', false],
];

const TYPE_BY_ROOT: Record<string, AccountType> = { '1': 'asset', '2': 'liability', '3': 'equity', '4': 'revenue', '5': 'expense' };

/** Accounts the system posts to — can't be deleted or turned into groups. */
const SYSTEM_CODES = new Set(['1101', '1102', '1103', '1104', '1105', '2101', '2201', '3101', '4101', '4102', '5101']);
/** Expense accounts that need a cost center on every posting. */
const COST_CENTER_CODES = new Set(['5201', '5202', '5203', '5204', '5205']);

let state: AccountsDb | null = null;

function db(): AccountsDb {
  return (state ??= seed());
}

function seed(): AccountsDb {
  const accounts: AccountRecord[] = [];
  for (const [code, name, isGroup, opening] of CHART) {
    const parent = [...accounts].reverse().find((a) => code.startsWith(a.code) && a.code !== code) ?? null;
    const type = TYPE_BY_ROOT[code[0]];
    accounts.push({
      id: `acc-${code}`,
      code,
      name,
      parentId: parent?.id ?? null,
      level: parent ? parent.level + 1 : 1,
      type,
      nature: ACCOUNT_TYPE_VIEW[type].nature,
      isGroup,
      costCenterRequired: COST_CENTER_CODES.has(code),
      currency: 'EGP',
      openingBalance: opening ?? 0,
      notes: '',
      isActive: true,
      isSystem: SYSTEM_CODES.has(code) || (isGroup && code.length === 1),
      createdAt: daysAgo(730),
    });
  }
  return { accounts };
}

export function accountRows(): AccountRecord[] {
  return db().accounts;
}

/** Next child code under `parentId`: parent code + 2 digits for leaves under level ≥ 2, else +1 digit. */
export function nextAccountCode(parentId: string | null): string {
  const rows = db().accounts;
  if (!parentId) {
    const max = rows.filter((a) => !a.parentId).reduce((m, a) => Math.max(m, Number(a.code)), 0);
    return String(max + 1);
  }
  const parent = rows.find((a) => a.id === parentId)!;
  const children = rows.filter((a) => a.parentId === parentId);
  const width = parent.level >= 2 || children.some((c) => c.code.length - parent.code.length === 2) ? 2 : 1;
  const max = children.reduce((m, c) => Math.max(m, Number(c.code.slice(parent.code.length)) || 0), 0);
  return parent.code + String(max + 1).padStart(width, '0');
}

/** All descendants of an account (ids), including itself. */
export function subtreeIds(accountId: string): Set<string> {
  const rows = db().accounts;
  const ids = new Set([accountId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const a of rows) {
      if (a.parentId && ids.has(a.parentId) && !ids.has(a.id)) {
        ids.add(a.id);
        grew = true;
      }
    }
  }
  return ids;
}
