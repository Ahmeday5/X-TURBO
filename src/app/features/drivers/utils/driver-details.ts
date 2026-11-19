import { EntityDetails } from '../../../shared/components/details-drawer/details-drawer.model';
import { formatDateTime, formatInteger, formatRelative } from '../../../shared/utils/format.util';
import { toLocalMobile } from '../../../shared/utils/phone.util';
import { Driver } from '../models/driver.model';

/** Read-only details of a driver (👁 in the drivers screen). */
export function toDriverDetails(d: Driver): EntityDetails {
  return {
    header: {
      title: d.name,
      subtitle: [toLocalMobile(d.phone), d.vehicleType, d.plateNumber].filter(Boolean).join(' · '),
      icon: 'truck',
      badge: d.isActive ? { label: 'نشط', tone: 'good' } : { label: 'موقوف', tone: 'danger' },
    },
    sections: [
      {
        title: 'الحساب',
        icon: 'user',
        fields: [
          { label: 'الموبايل (اسم الدخول)', value: toLocalMobile(d.phone), ltr: true },
          { label: 'آخر دخول', value: d.lastLoginAt ? `${formatRelative(d.lastLoginAt)} (${formatDateTime(d.lastLoginAt)})` : 'لم يسجل الدخول بعد', tone: d.lastLoginAt ? undefined : 'muted' },
          { label: 'تاريخ الإضافة', value: formatDateTime(d.createdAt) },
          { label: 'آخر تعديل', value: formatDateTime(d.updatedAt) },
        ],
      },
      {
        title: 'المركبة',
        icon: 'car',
        fields: [
          { label: 'النوع', value: d.vehicleType },
          { label: 'رقم اللوحة', value: d.plateNumber },
          { label: 'ملاحظات', value: d.notes, full: true },
        ],
      },
      {
        title: 'الطلبات',
        icon: 'cart',
        fields: [
          { label: 'طلبات جارية', value: formatInteger(d.activeOrders), tone: d.activeOrders ? 'info' : undefined },
          { label: 'تم تسليمها', value: formatInteger(d.deliveredOrders), tone: 'good' },
        ],
      },
    ],
  };
}
