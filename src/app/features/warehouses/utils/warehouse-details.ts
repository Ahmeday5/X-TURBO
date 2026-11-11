import { EntityDetails, yesNo } from '../../../shared/components/details-drawer/details-drawer.model';
import { formatDateTime, formatInteger, formatMoney } from '../../../shared/utils/format.util';
import { usageTone, Warehouse, WAREHOUSE_TYPE_VIEW } from '../models/warehouse.model';

const USAGE_TONE = { good: 'good', warning: 'warning', danger: 'danger' } as const;

/** Read-only details of a warehouse (👁 in the warehouses directory). */
export function toWarehouseDetails(w: Warehouse): EntityDetails {
  return {
    header: {
      title: w.name,
      subtitle: `${w.code} · ${WAREHOUSE_TYPE_VIEW[w.type].label}`,
      icon: 'warehouse',
      badge: w.isActive ? { label: w.isDefault ? 'نشط · افتراضي' : 'نشط', tone: 'good' } : { label: 'موقوف', tone: 'neutral' },
    },
    sections: [
      {
        title: 'بيانات المخزن',
        icon: 'warehouse',
        fields: [
          { label: 'الكود', value: w.code, ltr: true },
          { label: 'النوع', value: WAREHOUSE_TYPE_VIEW[w.type].label },
          { label: 'المدينة', value: w.city },
          { label: 'المسؤول', value: w.manager },
          { label: 'التليفون', value: w.phone, ltr: true },
          { label: 'تاريخ الإضافة', value: formatDateTime(w.createdAt) },
          { label: 'العنوان', value: w.address, full: true },
        ],
      },
      {
        title: 'المخزون والسعة',
        icon: 'layers',
        fields: [
          { label: 'عدد الأصناف', value: formatInteger(w.itemsCount) },
          { label: 'إجمالي الكميات', value: formatInteger(w.totalQty) },
          { label: 'قيمة المخزون', value: formatMoney(w.stockValue) },
          { label: 'أصناف تحت حد الطلب', value: formatInteger(w.lowStockCount), tone: w.lowStockCount ? 'warning' : undefined },
          { label: 'السعة', value: `${formatInteger(w.capacity)} وحدة` },
          { label: 'نسبة الإشغال', value: `${Math.round(w.usagePct)}%`, tone: USAGE_TONE[usageTone(w.usagePct)] },
        ],
      },
      {
        title: 'الإعدادات',
        icon: 'sliders',
        fields: [
          { label: 'المخزن الافتراضي', value: yesNo(w.isDefault) },
          { label: 'الصرف بالسالب', value: w.allowNegative ? 'مسموح' : 'غير مسموح' },
          { label: 'ملاحظات', value: w.notes, full: true },
        ],
      },
    ],
  };
}
