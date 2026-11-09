import { NUMBERING_KINDS, NumberingKind, SystemSettings } from '../../features/admin/models/settings.model';
import { daysAgo } from '../mock-utils';

const SEED_NUMBERING: Record<NumberingKind, [prefix: string, next: number]> = {
  quotation: ['QT', 58],
  sale: ['SI', 1245],
  'sale-return': ['SR', 37],
  purchase: ['PI', 312],
  'purchase-return': ['PR', 12],
  transfer: ['TR', 96],
  'goods-issue': ['GI', 141],
  'goods-receipt': ['GRN', 203],
  receipt: ['RV', 428],
  payment: ['PV', 365],
  journal: ['JV', 89],
};

let state: SystemSettings | null = null;

/** The single system settings record (lazily seeded). */
export function systemSettings(): SystemSettings {
  return (state ??= {
    company: {
      name: 'X-TURBO لقطع غيار السيارات',
      taxNumber: '512-874-339',
      commercialRegister: '184562',
      phone: '0225678900',
      email: 'info@xturbo.com',
      address: 'التجمع الخامس — شارع التسعين الجنوبي، القاهرة الجديدة',
      logoInitials: 'XT',
    },
    financial: {
      baseCurrency: 'EGP',
      vatRate: 14,
      pricesIncludeTax: false,
      fiscalYearStartMonth: 1,
      decimalPlaces: 2,
    },
    numbering: NUMBERING_KINDS.map((kind) => ({
      kind,
      prefix: SEED_NUMBERING[kind][0],
      nextNumber: SEED_NUMBERING[kind][1],
      digits: 6,
    })),
    inventory: {
      allowNegativeStock: false,
      lowStockThreshold: 5,
      defaultWarehouseId: null,
    },
    updatedAt: daysAgo(9),
    updatedBy: 'أحمد حسن',
  });
}

export function setSystemSettings(next: SystemSettings): void {
  state = next;
}
