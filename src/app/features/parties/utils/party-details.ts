import { EntityDetails, yesNo } from '../../../shared/components/details-drawer/details-drawer.model';
import { formatDateTime, formatMoney, formatRelative } from '../../../shared/utils/format.util';
import { BALANCE_SIDE_LABEL, balanceSide, Party, PARTY_KIND_VIEW, PRICE_LIST_LABEL } from '../models/party.model';
import { formatBalance } from './party-display.util';

/** Read-only details of a customer / supplier (👁 in the parties screens). */
export function toPartyDetails(p: Party): EntityDetails {
  const side = balanceSide(p.balance);
  const overLimit = p.creditLimit > 0 && p.balance > p.creditLimit;
  return {
    header: {
      title: p.name,
      subtitle: `${p.code} · ${PARTY_KIND_VIEW[p.kind].label}${p.isExternal ? ' · عميل خارجي' : ''}`,
      icon: 'users',
      badge: p.isActive ? { label: 'نشط', tone: 'good' } : { label: 'موقوف', tone: 'neutral' },
    },
    sections: [
      {
        title: 'بيانات الاتصال',
        icon: 'id-card',
        fields: [
          { label: 'الكود', value: p.code, ltr: true },
          { label: 'النوع', value: PARTY_KIND_VIEW[p.kind].label },
          { label: 'الموبايل', value: p.phone, ltr: true },
          { label: 'موبايل آخر', value: p.phone2, ltr: true },
          { label: 'البريد الإلكتروني', value: p.email, ltr: true },
          { label: 'المدينة', value: p.city },
          { label: 'العنوان', value: p.address, full: true },
        ],
      },
      {
        title: 'الرصيد والائتمان',
        icon: 'scale',
        fields: [
          { label: 'الرصيد الحالي', value: formatBalance(p.balance), tone: overLimit ? 'danger' : undefined },
          { label: 'طبيعة الرصيد', value: BALANCE_SIDE_LABEL[side] },
          { label: 'الرصيد الافتتاحي', value: formatBalance(p.openingBalance) },
          { label: 'حد الائتمان', value: p.creditLimit ? formatMoney(p.creditLimit) : 'بدون حد' },
          { label: 'مدة السداد', value: p.paymentTermDays ? `${p.paymentTermDays} يوم` : 'نقدي' },
          { label: 'قائمة الأسعار', value: PRICE_LIST_LABEL[p.priceList] },
          { label: 'آخر حركة', value: p.lastMovementAt ? formatRelative(p.lastMovementAt) : 'بدون حركات' },
        ],
      },
      {
        title: 'بيانات تجارية',
        icon: 'briefcase',
        fields: [
          { label: 'الرقم الضريبي', value: p.taxNumber, ltr: true },
          { label: 'السجل التجاري', value: p.commercialRegister, ltr: true },
          { label: 'مسجّل من نقطة البيع', value: yesNo(p.isExternal) },
          { label: 'تاريخ الإضافة', value: formatDateTime(p.createdAt) },
          { label: 'ملاحظات', value: p.notes, full: true },
        ],
      },
    ],
  };
}
