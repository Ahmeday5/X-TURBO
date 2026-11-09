import { DOC_KIND_CONFIG, DocKind } from '../../documents/models/document.model';
import { VOUCHER_KIND_CONFIG, VoucherKind } from '../../vouchers/models/voucher.model';
import { formatMoney } from '../../../shared/utils/format.util';
import { BALANCE_SIDE_LABEL, balanceSide, StatementEntry } from '../models/party.model';

/** "12,450 ج.م. مدين" — absolute amount + side, the way statements read. */
export function formatBalance(balance: number): string {
  const side = balanceSide(balance);
  return side === 'zero' ? formatMoney(0) : `${formatMoney(Math.abs(balance))} ${BALANCE_SIDE_LABEL[side]}`;
}

/** Tone of a balance pill: owed to us → info, we owe → warning. */
export function balanceTone(balance: number): 'info' | 'warning' | 'neutral' {
  const side = balanceSide(balance);
  return side === 'debit' ? 'info' : side === 'credit' ? 'warning' : 'neutral';
}

export interface SourceLink {
  route: string;
  queryParams: Record<string, string>;
}

/** Where a statement line's source record opens (documents: `?doc=`, vouchers: `?v=`). */
export function statementSourceLink(entry: Pick<StatementEntry, 'sourceType' | 'sourceKind' | 'sourceId'>): SourceLink | null {
  if (entry.sourceType === 'document') {
    const cfg = DOC_KIND_CONFIG[entry.sourceKind as DocKind];
    return cfg ? { route: cfg.route, queryParams: { doc: entry.sourceId } } : null;
  }
  if (entry.sourceType === 'voucher') {
    const cfg = VOUCHER_KIND_CONFIG[entry.sourceKind as VoucherKind];
    return cfg ? { route: cfg.route, queryParams: { v: entry.sourceId } } : null;
  }
  return null;
}

/** Short label for the source type column. */
export function statementSourceLabel(entry: Pick<StatementEntry, 'sourceType' | 'sourceKind'>): string {
  if (entry.sourceType === 'document') return DOC_KIND_CONFIG[entry.sourceKind as DocKind]?.singular ?? 'مستند';
  if (entry.sourceType === 'voucher') return VOUCHER_KIND_CONFIG[entry.sourceKind as VoucherKind]?.singular ?? 'سند';
  return 'رصيد افتتاحي';
}
