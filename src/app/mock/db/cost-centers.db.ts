import { CostCenter } from '../../features/accounts/models/cost-center.model';
import { GROUP_COLORS } from '../../features/items/models/item-group.model';
import { daysAgo } from '../mock-utils';

export type CostCenterRecord = Omit<CostCenter, 'actualSpend' | 'actualRevenue' | 'postingsCount' | 'parentName'>;

interface CostCentersDb {
  centers: CostCenterRecord[];
  nextNo: number;
}

const SEED: ReadonlyArray<[name: string, manager: string, budget: number]> = [
  ['الإدارة العامة', 'أحمد حسن', 1_800_000],
  ['المخزن الرئيسي', 'منى عادل', 950_000],
  ['فرع الإسكندرية', 'كريم السيد', 620_000],
  ['فرع الجيزة', 'هاني فؤاد', 540_000],
  ['فرع 6 أكتوبر', 'سامح رأفت', 480_000],
  ['صالة عرض التجمع', 'ياسمين فتحي', 410_000],
  ['المتجر الإلكتروني', 'خالد عادل', 720_000],
  ['التوصيل والشحن', 'رضا محمود', 360_000],
];

let state: CostCentersDb | null = null;

function db(): CostCentersDb {
  return (state ??= {
    centers: SEED.map(([name, manager, annualBudget], i) => ({
      id: `cc-${i + 1}`,
      code: `CC-${String(i + 1).padStart(2, '0')}`,
      name,
      parentId: null,
      manager,
      annualBudget,
      color: GROUP_COLORS[(i * 3) % GROUP_COLORS.length],
      notes: '',
      isActive: true,
      createdAt: daysAgo(700 - i * 20),
    })),
    nextNo: SEED.length + 1,
  });
}

export function costCenterRows(): CostCenterRecord[] {
  return db().centers;
}

export function nextCostCenterNo(): number {
  return db().nextNo++;
}

/** Cost center that matches a warehouse (for automatic tagging of seeded postings). */
export const WAREHOUSE_COST_CENTER: Readonly<Record<string, string>> = {
  'wh-cai': 'cc-2',
  'wh-alx': 'cc-3',
  'wh-giz': 'cc-4',
  'wh-oct': 'cc-5',
  'wh-shw': 'cc-6',
};
