import { EntityDetails } from '../../../shared/components/details-drawer/details-drawer.model';
import { formatDateTime, formatInteger, formatMoney } from '../../../shared/utils/format.util';
import { ItemGroup } from '../models/item-group.model';
import { Item, marginPct, STOCK_LEVEL_LABEL, stockLevel } from '../models/item.model';

const LEVEL_TONE = { ok: 'good', low: 'warning', out: 'danger' } as const;

/** Read-only details of an item (eye action in the items directory). */
export function toItemDetails(item: Item): EntityDetails {
  const level = stockLevel(item);
  return {
    header: {
      title: item.name,
      subtitle: `${item.code} · ${item.groupName}`,
      icon: 'box',
      badge: item.isActive ? { label: 'نشط', tone: 'good' } : { label: 'موقوف', tone: 'neutral' },
    },
    sections: [
      {
        title: 'البيانات الأساسية',
        icon: 'box',
        fields: [
          { label: 'الكود', value: item.code, ltr: true },
          { label: 'المجموعة', value: item.groupName },
          { label: 'الوحدة', value: item.unit },
          { label: 'الماركة', value: item.brand },
          { label: 'الباركود', value: item.barcode, ltr: true },
          { label: 'تاريخ الإضافة', value: formatDateTime(item.createdAt) },
          { label: 'متوافق مع', value: item.compatibleWith, full: true },
          { label: 'الوصف', value: item.description, full: true },
        ],
      },
      {
        title: 'التسعير',
        icon: 'coins',
        fields: [
          { label: 'سعر الشراء', value: formatMoney(item.purchasePrice) },
          { label: 'سعر البيع', value: formatMoney(item.salePrice) },
          {
            label: 'الهامش',
            value: `${marginPct(item.purchasePrice, item.salePrice)}%`,
            tone: item.salePrice < item.purchasePrice ? 'danger' : 'good',
          },
          { label: 'الربح للوحدة', value: formatMoney(item.salePrice - item.purchasePrice) },
        ],
      },
      {
        title: 'المخزون',
        icon: 'layers',
        fields: [
          { label: 'الرصيد', value: `${formatInteger(item.stock)} ${item.unit}`, tone: LEVEL_TONE[level] },
          { label: 'حالة الرصيد', value: STOCK_LEVEL_LABEL[level], tone: LEVEL_TONE[level] },
          { label: 'حد الطلب', value: `${formatInteger(item.minStock)} ${item.unit}` },
        ],
      },
      {
        title: 'تقييمات العملاء',
        icon: 'star',
        fields: [
          {
            label: 'متوسط التقييم',
            value: item.reviewsCount ? `${item.averageRating.toFixed(1)} من 5` : 'لا توجد تقييمات بعد',
            tone: item.reviewsCount ? undefined : 'muted',
          },
          { label: 'عدد التقييمات', value: formatInteger(item.reviewsCount) },
        ],
      },
    ],
  };
}

/** Read-only details of an item group (eye action in the groups screen). */
export function toItemGroupDetails(group: ItemGroup): EntityDetails {
  return {
    header: {
      title: group.name,
      subtitle: group.code,
      icon: 'folder',
      badge: group.isActive ? { label: 'نشطة', tone: 'good' } : { label: 'موقوفة', tone: 'neutral' },
    },
    sections: [
      {
        title: 'بيانات المجموعة',
        icon: 'folder',
        fields: [
          { label: 'الكود', value: group.code, ltr: true },
          { label: 'المجموعة الرئيسية', value: group.parentName ?? 'مجموعة رئيسية' },
          { label: 'عدد الأصناف', value: formatInteger(group.itemsCount) },
          { label: 'تاريخ الإضافة', value: formatDateTime(group.createdAt) },
          { label: 'الوصف', value: group.description, full: true },
        ],
      },
    ],
  };
}
