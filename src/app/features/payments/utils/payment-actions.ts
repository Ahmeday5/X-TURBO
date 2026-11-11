import { RowAction } from '../../../shared/models/row-action.model';
import { canRefund, canRetry, canSettle, PaymentSummary } from '../models/payment.model';

export type PaymentAction = 'confirm' | 'fail' | 'retry' | 'settle' | 'refund';

/**
 * Payment rules in ONE place — the table row menu and the drawer footer both
 * render this list (the drawer opens the matching form / confirm for each).
 */
export function paymentActions(
  p: Pick<PaymentSummary, 'status' | 'method' | 'amount' | 'refunded' | 'settlementStatus'>,
): RowAction<PaymentAction>[] {
  const actions: RowAction<PaymentAction>[] = [];
  if (p.status === 'pending') {
    actions.push({ key: 'confirm', label: p.method === 'cod' ? 'تأكيد التحصيل' : 'تأكيد السداد', icon: 'check', tone: 'primary' });
  }
  if (canRetry(p)) actions.push({ key: 'retry', label: 'إعادة محاولة التحصيل', icon: 'refresh', tone: 'primary' });
  if (canSettle(p)) actions.push({ key: 'settle', label: 'تأكيد التسوية', icon: 'scale', ...(actions.length ? {} : { tone: 'primary' as const }) });
  if (canRefund(p)) actions.push({ key: 'refund', label: 'استرداد', icon: 'return' });
  if (p.status === 'pending') actions.push({ key: 'fail', label: 'تعذّر التحصيل', icon: 'x', tone: 'danger', separated: true });
  return actions;
}
