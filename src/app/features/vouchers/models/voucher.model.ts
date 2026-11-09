import { StatusView } from '../../../shared/models/status-tone.model';

/**
 * Financial vouchers.
 *  - receipt (سند قبض): money in to a cash/bank account, from a party or an account.
 *  - payment (سند صرف): money out of a cash/bank account, to a party or an account (expense…).
 *  - journal (سند قيد): free double-entry lines; Σdebit must equal Σcredit.
 */
export type VoucherKind = 'receipt' | 'payment' | 'journal';
export type VoucherStatus = 'draft' | 'posted' | 'cancelled';
export type VoucherMethod = 'cash' | 'bank' | 'card' | 'cheque' | 'wallet';
/** Who the money comes from / goes to (receipt & payment). */
export type CounterpartyType = 'party' | 'account';

export interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  costCenterId: string | null;
  costCenterName: string | null;
  note: string;
}

export interface Voucher {
  id: string;
  kind: VoucherKind;
  /** `RV-000123` / `PV-000123` / `JV-000123`. */
  number: string;
  /** ISO date. */
  date: string;
  status: VoucherStatus;
  description: string;
  /** Cheque / transfer number, external ref… */
  reference: string;

  // ── receipt / payment ──
  counterpartyType: CounterpartyType | null;
  partyId: string | null;
  partyName: string | null;
  /** Counter account when `counterpartyType = 'account'` (expense, revenue…). */
  accountId: string | null;
  accountName: string | null;
  /** The cash box / bank account the money moves through. */
  cashAccountId: string | null;
  cashAccountName: string | null;
  method: VoucherMethod | null;
  amount: number;
  costCenterId: string | null;
  costCenterName: string | null;

  // ── journal ──
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;

  createdBy: string;
  createdAt: string;
  postedAt: string | null;
}

export type VoucherSummary = Omit<Voucher, 'lines'> & { linesCount: number };

export interface JournalLinePayload {
  accountId: string;
  debit: number;
  credit: number;
  costCenterId: string | null;
  note: string;
}

export interface VoucherPayload {
  kind: VoucherKind;
  date: string;
  description: string;
  reference: string;
  counterpartyType: CounterpartyType | null;
  partyId: string | null;
  accountId: string | null;
  cashAccountId: string | null;
  method: VoucherMethod | null;
  amount: number;
  costCenterId: string | null;
  lines: JournalLinePayload[];
  post: boolean;
}

export interface VoucherStats {
  count: number;
  draft: number;
  posted: number;
  cancelled: number;
  /** Σ amount (receipt/payment) or Σ debit (journal) of non-cancelled vouchers. */
  total: number;
  /** Same, for the current calendar month. */
  thisMonth: number;
}

// ── Display maps ──

export interface VoucherKindConfig {
  kind: VoucherKind;
  route: string;
  title: string;
  singular: string;
  prefix: string;
  /** Direction of cash for receipt/payment. */
  direction: 'in' | 'out' | null;
  partyLabel: string;
}

export const VOUCHER_KIND_CONFIG: Record<VoucherKind, VoucherKindConfig> = {
  receipt: {
    kind: 'receipt',
    route: '/vouchers/receipt',
    title: 'سندات القبض',
    singular: 'سند قبض',
    prefix: 'RV',
    direction: 'in',
    partyLabel: 'مقبوض من',
  },
  payment: {
    kind: 'payment',
    route: '/vouchers/payment',
    title: 'سندات الصرف',
    singular: 'سند صرف',
    prefix: 'PV',
    direction: 'out',
    partyLabel: 'مصروف إلى',
  },
  journal: {
    kind: 'journal',
    route: '/vouchers/journal',
    title: 'سندات القيد',
    singular: 'سند قيد',
    prefix: 'JV',
    direction: null,
    partyLabel: '',
  },
};

export const VOUCHER_STATUSES: readonly VoucherStatus[] = ['draft', 'posted', 'cancelled'];

export const VOUCHER_STATUS_VIEW: Record<VoucherStatus, StatusView> = {
  draft: { label: 'مسودة', tone: 'neutral', color: 'var(--txt3)' },
  posted: { label: 'مُرحّل', tone: 'good', color: 'var(--gr)' },
  cancelled: { label: 'ملغي', tone: 'danger', color: 'var(--re)' },
};

export const VOUCHER_METHODS: readonly VoucherMethod[] = ['cash', 'bank', 'card', 'cheque', 'wallet'];

export const VOUCHER_METHOD_LABEL: Record<VoucherMethod, string> = {
  cash: 'نقدي',
  bank: 'تحويل بنكي',
  card: 'بطاقة',
  cheque: 'شيك',
  wallet: 'محفظة إلكترونية',
};
