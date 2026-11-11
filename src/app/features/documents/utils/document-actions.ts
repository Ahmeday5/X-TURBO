import { RowAction } from '../../../shared/models/row-action.model';
import { DOC_KIND_CONFIG, DocKind, DocStatus } from '../models/document.model';

/** Everything a document's status allows. `convert:<kind>` creates a linked draft of that kind. */
export type DocAction = 'post' | 'edit' | 'delete' | 'complete' | 'cancel' | 'labels' | 'print' | `convert:${DocKind}`;

export const isConvertAction = (a: DocAction): a is `convert:${DocKind}` => a.startsWith('convert:');
export const convertTarget = (a: `convert:${DocKind}`): DocKind => a.slice('convert:'.length) as DocKind;

/**
 * The lifecycle rules in ONE place — the table row menu and the drawer footer
 * both render this list, so they always offer the same actions.
 *
 *   draft     → post · edit · delete
 *   posted    → complete (if the kind has a follow-up) · convert · cancel
 *   completed → convert (not for quotations — already converted)
 *   always    → barcode labels (stock coming in) · print
 */
export function documentActions(d: { kind: DocKind; status: DocStatus }, hasLines: boolean): RowAction<DocAction>[] {
  const cfg = DOC_KIND_CONFIG[d.kind];
  const actions: RowAction<DocAction>[] = [];
  const convert = (to: DocKind, primary: boolean): RowAction<DocAction> => ({
    key: `convert:${to}`,
    label: d.kind === 'quotation' ? 'تحويل إلى فاتورة بيع' : `إنشاء ${DOC_KIND_CONFIG[to].singular}`,
    icon: DOC_KIND_CONFIG[to].icon,
    ...(primary ? { tone: 'primary' as const } : {}),
  });

  switch (d.status) {
    case 'draft':
      actions.push(
        { key: 'post', label: d.kind === 'quotation' ? 'اعتماد' : 'ترحيل', icon: 'check', tone: 'primary' },
        { key: 'edit', label: 'تعديل', icon: 'edit' },
      );
      break;
    case 'posted':
      if (cfg.completeAction) {
        actions.push({ key: 'complete', label: cfg.completeAction.label, icon: cfg.completeAction.icon, tone: 'primary' });
      }
      for (const to of cfg.convertTo ?? []) actions.push(convert(to, d.kind === 'quotation' && !cfg.completeAction));
      break;
    case 'completed':
      if (d.kind !== 'quotation') for (const to of cfg.convertTo ?? []) actions.push(convert(to, false));
      break;
  }

  if (cfg.stock === 'in' && d.status !== 'cancelled' && hasLines) {
    actions.push({ key: 'labels', label: 'ملصقات باركود', icon: 'barcode' });
  }
  actions.push({ key: 'print', label: 'طباعة', icon: 'file-lines' });

  if (d.status === 'draft') actions.push({ key: 'delete', label: 'حذف المسودة', icon: 'trash', tone: 'danger', separated: true });
  if (d.status === 'posted') actions.push({ key: 'cancel', label: 'إلغاء المستند', icon: 'x', tone: 'danger', separated: true });
  return actions;
}
