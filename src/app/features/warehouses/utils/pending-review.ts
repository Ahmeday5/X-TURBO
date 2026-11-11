import { ArabicPluralForms } from '../../../shared/utils/plural.util';

/** Pending purchase invoices per warehouse id (warehouses without any are absent or 0). */
export type PendingReviewCounts = Readonly<Record<string, number>>;

export const PENDING_INVOICES_PLURAL: ArabicPluralForms = {
  one: 'فاتورة شراء واحدة',
  two: 'فاتورتا شراء',
  few: '# فواتير شراء',
  other: '# فاتورة شراء',
};

/** Route of the warehouse manager's review queue. */
export const PURCHASE_REVIEW_ROUTE = '/warehouses/purchase-review';
