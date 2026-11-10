import { StatusView } from '../../../shared/models/status-tone.model';
import { ArabicPluralForms } from '../../../shared/utils/plural.util';
import { DOC_KIND_CONFIG, DocKind, DocKindConfig } from '../models/document.model';

/** Settlement state of a financial document. */
export type PaymentState = 'paid' | 'partial' | 'unpaid';

export function paymentState(doc: { paid: number; remaining: number }): PaymentState {
  if (doc.remaining <= 0) return 'paid';
  return doc.paid > 0 ? 'partial' : 'unpaid';
}

export const PAYMENT_STATE_VIEW: Record<PaymentState, StatusView> = {
  paid: { label: 'مسدد', tone: 'good', color: 'var(--gr)' },
  partial: { label: 'مسدد جزئيًا', tone: 'info', color: 'var(--bl)' },
  unpaid: { label: 'غير مسدد', tone: 'warning', color: 'var(--am)' },
};

/** Payment tracking applies to invoices and returns (not quotations, reservations or stock moves). */
export function tracksPayment(cfg: DocKindConfig): boolean {
  return cfg.financial && cfg.stock !== 'none' && cfg.kind !== 'reservation';
}

/** Kinds that take stock out of the source warehouse (availability matters). */
export function isOutgoing(cfg: DocKindConfig): boolean {
  return cfg.stock === 'out' || cfg.stock === 'move' || cfg.stock === 'reserve';
}

export function partyLabel(cfg: DocKindConfig): string {
  return cfg.party === 'supplier' ? 'المورد' : 'العميل';
}

/** "فاتورة بيع جديدة" / "سند صرف جديد". */
export function newLabel(kind: DocKind): string {
  const singular = DOC_KIND_CONFIG[kind].singular;
  return `${singular} ${singular.startsWith('فاتورة') ? 'جديدة' : 'جديد'}`;
}

export const LINES_PLURAL: ArabicPluralForms = {
  one: 'صنف واحد',
  two: 'صنفان',
  few: '# أصناف',
  other: '# صنف',
};

export const DOCS_PLURAL: ArabicPluralForms = {
  one: 'مستند واحد',
  two: 'مستندان',
  few: '# مستندات',
  other: '# مستند',
};
