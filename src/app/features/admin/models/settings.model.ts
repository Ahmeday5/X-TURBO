/** System-wide settings (one record). POS has its own screen at /pos/settings. */
export interface CompanyProfile {
  name: string;
  /** الرقم الضريبي. */
  taxNumber: string;
  /** السجل التجاري. */
  commercialRegister: string;
  phone: string;
  email: string;
  address: string;
  /** 1–3 characters shown as the logo badge on prints. */
  logoInitials: string;
}

export interface FinancialSettings {
  /** Read-only — the ledger currency. */
  baseCurrency: 'EGP';
  vatRate: number;
  pricesIncludeTax: boolean;
  /** 1 = January … 12 = December. */
  fiscalYearStartMonth: number;
  decimalPlaces: number;
}

export type NumberingKind =
  | 'quotation'
  | 'sale'
  | 'purchase'
  | 'sale-return'
  | 'purchase-return'
  | 'transfer'
  | 'goods-issue'
  | 'goods-receipt'
  | 'receipt'
  | 'payment'
  | 'journal';

export interface NumberingRule {
  kind: NumberingKind;
  prefix: string;
  nextNumber: number;
  /** Zero-padded width of the number part. */
  digits: number;
}

export interface InventorySettings {
  allowNegativeStock: boolean;
  lowStockThreshold: number;
  /** `null` = the warehouse flagged as default in the warehouses directory. */
  defaultWarehouseId: string | null;
}

export interface SystemSettings {
  company: CompanyProfile;
  financial: FinancialSettings;
  numbering: NumberingRule[];
  inventory: InventorySettings;
  updatedAt: string;
  updatedBy: string;
}

export type SystemSettingsPayload = Omit<SystemSettings, 'updatedAt' | 'updatedBy'>;

export const NUMBERING_KINDS: readonly NumberingKind[] = [
  'quotation',
  'sale',
  'purchase',
  'sale-return',
  'purchase-return',
  'transfer',
  'goods-issue',
  'goods-receipt',
  'receipt',
  'payment',
  'journal',
];

export const NUMBERING_LABEL: Record<NumberingKind, { label: string; group: string }> = {
  quotation: { label: 'عرض سعر', group: 'المبيعات' },
  sale: { label: 'فاتورة مبيعات', group: 'المبيعات' },
  'sale-return': { label: 'مرتجع مبيعات', group: 'المبيعات' },
  purchase: { label: 'فاتورة مشتريات', group: 'المشتريات' },
  'purchase-return': { label: 'مرتجع مشتريات', group: 'المشتريات' },
  transfer: { label: 'تحويل مخزني', group: 'المخزون' },
  'goods-issue': { label: 'سند صرف بضاعة', group: 'المخزون' },
  'goods-receipt': { label: 'سند استلام بضاعة', group: 'المخزون' },
  receipt: { label: 'سند قبض', group: 'المالية' },
  payment: { label: 'سند صرف', group: 'المالية' },
  journal: { label: 'سند قيد', group: 'المالية' },
};

export const MONTHS_AR: readonly string[] = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/**
 * Numbering kinds the API still returns but this dashboard no longer issues
 * (goods issue / receipt screens were removed). Hidden from the settings
 * screen, yet kept in the form so `PUT /settings` sends them back untouched.
 */
export const HIDDEN_NUMBERING_KINDS: ReadonlySet<string> = new Set(['goods-issue', 'goods-receipt']);

/**
 * The prefix rule as a regex (1–5 capital English letters) — for the dev mock.
 * Forms use `AppValidators.docPrefix()`, which explains the rule to the user.
 */
export const PREFIX_PATTERN = /^[A-Z]{1,5}$/;

/** Business-rule codes the settings API answers with (409). */
export const SETTINGS_ERROR_CODES = {
  /** The new prefix / next number would issue a document number that already exists. */
  numberCollision: 'NUMBER_COLLISION',
} as const;

/** `SI-000124`. */
export function previewNumber(prefix: string, next: number, digits: number): string {
  const n = Math.max(1, Math.floor(Number(next) || 1));
  const width = Math.min(Math.max(Math.floor(Number(digits) || 0), 1), 10);
  return `${(prefix || '—').toUpperCase()}-${String(n).padStart(width, '0')}`;
}
