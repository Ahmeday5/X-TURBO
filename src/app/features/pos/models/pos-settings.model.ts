import { DocPaymentMethod } from '../../documents/models/document.model';

/** POS configuration (one record for the store). */
export interface PosSettings {
  /** Warehouse the terminal sells from; null → the system default warehouse. */
  warehouseId: string | null;
  /** Cash box the till settles into (leaf account id: 1101 / 1105 / 1102). */
  cashAccountId: string;
  /** Payment methods offered on the terminal (subset of cash | card | wallet | credit). */
  paymentMethods: PosPaymentMethod[];
  defaultTaxPct: number;
  allowDiscount: boolean;
  /** Max discount % a cashier may give (per line and on the whole sale). */
  maxDiscountPct: number;
  receiptHeader: string;
  receiptFooter: string;
  paperWidth: 58 | 80;
  autoPrint: boolean;
  updatedAt: string;
  updatedBy: string;
}

export type PosSettingsPayload = Omit<PosSettings, 'updatedAt' | 'updatedBy'>;

export type PosPaymentMethod = Extract<DocPaymentMethod, 'cash' | 'card' | 'wallet' | 'credit'>;

export const POS_PAYMENT_METHODS: readonly PosPaymentMethod[] = ['cash', 'card', 'wallet', 'credit'];

/** Cash boxes the till may settle into. */
export const POS_CASH_ACCOUNTS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'acc-1105', label: 'خزينة نقطة البيع' },
  { id: 'acc-1101', label: 'الصندوق الرئيسي' },
  { id: 'acc-1102', label: 'البنك الأهلي — حساب جاري' },
];
