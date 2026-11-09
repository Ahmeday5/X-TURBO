import { StatusView } from '../../../shared/models/status-tone.model';

/**
 * Chart of accounts node. Group accounts (`isGroup`) only roll up their
 * children; postings go to leaf accounts.
 *
 * `balance` follows the account's nature: positive = balance on its normal
 * side (debit for assets/expenses, credit for liabilities/equity/revenue).
 */
export interface Account {
  id: string;
  /** Hierarchical code: `1`, `11`, `1101`… — child codes extend the parent's. */
  code: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  /** 1 = root. */
  level: number;
  type: AccountType;
  nature: AccountNature;
  isGroup: boolean;
  /** Postings must carry a cost center. */
  costCenterRequired: boolean;
  /** ISO-4217, e.g. `EGP`. */
  currency: string;
  /** On the account's normal side. */
  openingBalance: number;
  notes: string;
  isActive: boolean;
  /** System accounts (cash, customers control…) can't be deleted. */
  isSystem: boolean;
  createdAt: string;

  // ── Computed by the server ──
  /** Opening + postings (rolled up for groups), on the normal side. */
  balance: number;
  totalDebit: number;
  totalCredit: number;
  childrenCount: number;
}

export type AccountPayload = Pick<
  Account,
  'name' | 'parentId' | 'type' | 'nature' | 'isGroup' | 'costCenterRequired' | 'currency' | 'openingBalance' | 'notes' | 'isActive'
>;

/** Minimal shape for selects (`label` = "code — name"). */
export interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  isGroup: boolean;
  level: number;
  costCenterRequired: boolean;
}

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type AccountNature = 'debit' | 'credit';

export const ACCOUNT_TYPES: readonly AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export const ACCOUNT_TYPE_VIEW: Record<AccountType, StatusView & { nature: AccountNature }> = {
  asset: { label: 'أصول', tone: 'info', color: 'var(--bl)', nature: 'debit' },
  liability: { label: 'خصوم', tone: 'warning', color: 'var(--am)', nature: 'credit' },
  equity: { label: 'حقوق ملكية', tone: 'neutral', color: 'var(--pu)', nature: 'credit' },
  revenue: { label: 'إيرادات', tone: 'good', color: 'var(--gr)', nature: 'credit' },
  expense: { label: 'مصروفات', tone: 'danger', color: 'var(--re)', nature: 'debit' },
};

export const ACCOUNT_NATURE_LABEL: Record<AccountNature, string> = {
  debit: 'مدين',
  credit: 'دائن',
};

/**
 * Well-known leaf accounts the system posts to automatically. Their ids are
 * stable so documents and vouchers can reference them.
 */
export const SYSTEM_ACCOUNTS = {
  cash: 'acc-1101',
  bank: 'acc-1102',
  customers: 'acc-1103',
  inventory: 'acc-1104',
  suppliers: 'acc-2101',
  vat: 'acc-2201',
  capital: 'acc-3101',
  sales: 'acc-4101',
  salesReturns: 'acc-4102',
  cogs: 'acc-5101',
} as const;
