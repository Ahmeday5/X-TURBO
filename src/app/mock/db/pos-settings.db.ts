import { PosSettings } from '../../features/pos/models/pos-settings.model';
import { daysAgo } from '../mock-utils';

let state: PosSettings | null = null;

/** The single POS settings record (lazily seeded). */
export function posSettings(): PosSettings {
  return (state ??= {
    warehouseId: 'wh-shw',
    cashAccountId: 'acc-1105',
    paymentMethods: ['cash', 'card', 'wallet', 'credit'],
    defaultTaxPct: 0,
    allowDiscount: true,
    maxDiscountPct: 15,
    receiptHeader: 'X-TURBO لقطع غيار السيارات\nالتجمع الخامس — شارع التسعين الجنوبي',
    receiptFooter: 'شكرًا لزيارتكم — الاستبدال خلال 14 يومًا بالفاتورة',
    paperWidth: 80,
    autoPrint: false,
    updatedAt: daysAgo(12),
    updatedBy: 'أحمد حسن',
  });
}

export function setPosSettings(next: PosSettings): void {
  state = next;
}
