import { RowAction } from '../../../shared/models/row-action.model';
import { VoucherStatus } from '../models/voucher.model';

export type VoucherAction = 'post' | 'edit' | 'delete' | 'cancel' | 'print';

/**
 * Voucher lifecycle rules in ONE place — the table row menu and the drawer
 * footer both render this list.  draft → post · edit · delete;  posted → cancel;  always → print.
 */
export function voucherActions(v: { status: VoucherStatus }): RowAction<VoucherAction>[] {
  const actions: RowAction<VoucherAction>[] = [];
  if (v.status === 'draft') {
    actions.push({ key: 'post', label: 'ترحيل', icon: 'check', tone: 'primary' }, { key: 'edit', label: 'تعديل', icon: 'edit' });
  }
  actions.push({ key: 'print', label: 'طباعة', icon: 'file-lines' });
  if (v.status === 'draft') actions.push({ key: 'delete', label: 'حذف المسودة', icon: 'trash', tone: 'danger', separated: true });
  if (v.status === 'posted') actions.push({ key: 'cancel', label: 'إلغاء السند', icon: 'x', tone: 'danger', separated: true });
  return actions;
}
