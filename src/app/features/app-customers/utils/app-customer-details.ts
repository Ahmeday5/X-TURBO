import { EntityDetails } from '../../../shared/components/details-drawer/details-drawer.model';
import { formatDateTime, formatInteger, formatRelative } from '../../../shared/utils/format.util';
import { toLocalMobile } from '../../../shared/utils/phone.util';
import { AppCustomer, appCustomerStatusView } from '../models/app-customer.model';

const when = (iso: string | null, empty: string): string => (iso ? `${formatRelative(iso)} (${formatDateTime(iso)})` : empty);

/** "تم التغيير بواسطة X في Y" — or why there's nothing to show. */
function statusChangeLine(c: AppCustomer): string {
  if (!c.statusChangedAt) return c.status === 'pending' ? 'لم تتم المراجعة بعد' : 'لم تتغير منذ التسجيل';
  const by = c.statusChangedBy ? `بواسطة ${c.statusChangedBy}` : '';
  return `تم التغيير ${by} في ${formatDateTime(c.statusChangedAt)}`.replace(/\s+/g, ' ');
}

/** Read-only details of an app customer (👁 in the app-customers screen). */
export function toAppCustomerDetails(c: AppCustomer): EntityDetails {
  const view = appCustomerStatusView(c.status);
  return {
    header: {
      title: c.name,
      subtitle: [toLocalMobile(c.phone), c.governorate].filter(Boolean).join(' · '),
      icon: 'user',
      badge: { label: view.label, tone: view.tone },
    },
    sections: [
      {
        title: 'البيانات',
        icon: 'id-card',
        fields: [
          { label: 'الموبايل', value: toLocalMobile(c.phone), ltr: true },
          {
            label: 'تأكيد الموبايل (SMS)',
            value: c.phoneVerified ? 'تم التأكيد' : 'لم يؤكد بعد — لا يمكن تفعيله',
            tone: c.phoneVerified ? 'good' : 'warning',
          },
          { label: 'البريد الإلكتروني', value: c.email, ltr: true },
          { label: 'المحافظة', value: c.governorate },
          {
            label: 'الموقع المحفوظ',
            value: c.latitude !== null && c.longitude !== null ? `${c.latitude}, ${c.longitude}` : null,
            ltr: true,
            full: true,
          },
        ],
      },
      {
        title: 'الحالة',
        icon: 'shield',
        fields: [
          { label: 'الحالة الحالية', value: view.label, tone: view.tone === 'neutral' ? 'muted' : view.tone },
          { label: 'آخر تغيير للحالة', value: statusChangeLine(c), full: true, tone: c.statusChangedAt ? undefined : 'muted' },
        ],
      },
      {
        title: 'النشاط',
        icon: 'chart',
        fields: [
          { label: 'عدد الطلبات', value: formatInteger(c.ordersCount) },
          { label: 'أجهزة الإشعارات', value: c.devices ? formatInteger(c.devices) : 'لا يوجد — الإشعارات داخل التطبيق فقط' },
          { label: 'آخر دخول', value: when(c.lastLoginAt, 'لم يسجل الدخول بعد'), tone: c.lastLoginAt ? undefined : 'muted' },
          { label: 'تاريخ التسجيل', value: formatDateTime(c.createdAt) },
          { label: 'آخر تعديل', value: formatDateTime(c.updatedAt) },
        ],
      },
      {
        title: 'الحساب المحاسبي',
        icon: 'users',
        fields: [
          {
            label: 'العملاء والموردون',
            value: c.partyCode ? `كود ${c.partyCode}` : 'يُنشأ تلقائيًا عند التفعيل',
            tone: c.partyId ? 'good' : 'muted',
            full: true,
          },
        ],
      },
    ],
  };
}
