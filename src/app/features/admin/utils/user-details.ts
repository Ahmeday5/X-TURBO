import { EntityDetails } from '../../../shared/components/details-drawer/details-drawer.model';
import { formatDateTime, formatRelative } from '../../../shared/utils/format.util';
import { AdminUser, permissionLabel, ROLE_VIEW } from '../models/user.model';

/** Read-only details of a system user (👁 in the users screen). */
export function toUserDetails(u: AdminUser): EntityDetails {
  return {
    header: {
      title: u.name,
      subtitle: `${ROLE_VIEW[u.role]?.label ?? u.role} · ${u.email}`,
      icon: 'user',
      badge: u.isActive ? { label: 'نشط', tone: 'good' } : { label: 'موقوف', tone: 'danger' },
    },
    sections: [
      {
        title: 'الحساب',
        icon: 'user',
        fields: [
          { label: 'البريد الإلكتروني', value: u.email, ltr: true },
          { label: 'الموبايل', value: u.phone, ltr: true },
          { label: 'الدور', value: ROLE_VIEW[u.role]?.label ?? u.role },
          { label: 'آخر دخول', value: u.lastLoginAt ? `${formatRelative(u.lastLoginAt)} (${formatDateTime(u.lastLoginAt)})` : 'لم يسجل الدخول بعد' },
          { label: 'تاريخ الإنشاء', value: formatDateTime(u.createdAt) },
          { label: 'آخر تعديل', value: formatDateTime(u.updatedAt) },
        ],
      },
      {
        title: `الصلاحيات (${u.permissions.length})`,
        icon: 'shield',
        fields: [
          {
            label: 'الشاشات المسموح بها',
            value: u.permissions.length ? u.permissions.map(permissionLabel).join('\n') : 'بدون صلاحيات',
            full: true,
            tone: u.permissions.length ? undefined : 'danger',
          },
        ],
      },
    ],
  };
}
