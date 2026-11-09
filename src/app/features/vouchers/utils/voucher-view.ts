import { IconName } from '../../../shared/components/icon/icon.component';
import { ArabicPluralForms } from '../../../shared/utils/plural.util';
import { Voucher, VOUCHER_KIND_CONFIG, VoucherKind, VoucherSummary } from '../models/voucher.model';

export const VOUCHER_KINDS: readonly VoucherKind[] = ['journal', 'receipt', 'payment'];

export const VOUCHER_KIND_ICON: Record<VoucherKind, IconName> = {
  journal: 'journal',
  receipt: 'cash-in',
  payment: 'cash-out',
};

export function voucherKindForRoute(route: string): VoucherKind | null {
  return VOUCHER_KINDS.find((k) => VOUCHER_KIND_CONFIG[k].route === route) ?? null;
}

export const VOUCHERS_PLURAL: ArabicPluralForms = {
  zero: 'لا توجد سندات',
  one: 'سند واحد',
  two: 'سندان',
  few: '# سندات',
  many: '# سندًا',
  other: '# سند',
};

export const JOURNAL_LINES_PLURAL: ArabicPluralForms = {
  zero: 'بلا أسطر',
  one: 'سطر واحد',
  two: 'سطران',
  few: '# أسطر',
  many: '# سطرًا',
  other: '# سطر',
};

export const newVoucherLabel = (kind: VoucherKind): string => `${VOUCHER_KIND_CONFIG[kind].singular} جديد`;

/** Who the money came from / went to (party or counter account). */
export const counterpartyName = (v: Pick<Voucher | VoucherSummary, 'partyName' | 'accountName'>): string =>
  v.partyName ?? v.accountName ?? '—';

export const cashSideLabel = (kind: VoucherKind): string => (kind === 'receipt' ? 'إلى خزينة / بنك' : 'من خزينة / بنك');
