import { RowAction } from '../../../shared/models/row-action.model';

export type StockAction = 'card' | 'transfer' | 'labels';

/** Shortcuts from an item's balance — the stock table row menu and the item drawer show the same list. */
export const STOCK_ACTIONS: readonly RowAction<StockAction>[] = [
  { key: 'card', label: 'بطاقة الصنف', icon: 'edit' },
  { key: 'transfer', label: 'تحويل مخزني', icon: 'swap' },
  { key: 'labels', label: 'طباعة ملصق باركود', icon: 'barcode' },
];

/** Where each shortcut goes for an item. */
export function stockActionTarget(action: StockAction, itemId: string): { route: string; params: Record<string, string> } {
  switch (action) {
    case 'card':
      return { route: '/items/define', params: { id: itemId } };
    case 'transfer':
      return { route: '/invoices/transfers', params: { doc: 'new' } };
    case 'labels':
      return { route: '/items/barcode-labels', params: { items: itemId } };
  }
}
