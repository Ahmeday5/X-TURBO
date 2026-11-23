import { EntityDetails } from '../../../shared/components/details-drawer/details-drawer.model';
import { formatMoney } from '../../../shared/utils/format.util';
import { deliveryDaysLabel, DeliveryZone } from '../models/delivery-zone.model';

/** "120 ج.م" · "مجاني" · "غير متاح" (fee `null`). */
const extraFee = (fee: number | null): string => (fee === null || fee === undefined ? 'غير متاح' : fee === 0 ? 'مجاني' : formatMoney(fee));

/** Delivery zone details — built from the list row (the API has no GET /delivery-zones/{id}). */
export function toZoneDetails(z: DeliveryZone): EntityDetails {
  return {
    header: {
      title: `التوصيل إلى ${z.governorate}`,
      subtitle: deliveryDaysLabel(z.estimatedDaysMin, z.estimatedDaysMax),
      icon: 'truck',
      badge: z.isActive ? { label: 'مفعّلة', tone: 'good' } : { label: 'موقوفة', tone: 'warning' },
    },
    sections: [
      {
        title: 'شروط التوصيل',
        icon: 'truck',
        fields: [
          { label: 'المحافظة', value: z.governorate },
          { label: 'رسوم التوصيل', value: z.fee === 0 ? 'مجاني' : formatMoney(z.fee) },
          { label: 'أقل مدة', value: deliveryDaysLabel(z.estimatedDaysMin, z.estimatedDaysMin) },
          { label: 'أقصى مدة', value: deliveryDaysLabel(z.estimatedDaysMax, z.estimatedDaysMax) },
          {
            label: 'الشحن المجاني (العادي فقط)',
            value: z.freeShippingThreshold ? `للطلبات من ${formatMoney(z.freeShippingThreshold)}` : 'غير متاح',
          },
          {
            label: 'الحالة في التطبيق',
            value: z.isActive ? 'التوصيل متاح' : 'لا يوجد توصيل لهذه المحافظة',
            tone: z.isActive ? 'good' : 'warning',
          },
        ],
      },
      {
        title: 'أنواع توصيل إضافية',
        icon: 'bolt',
        fields: [
          { label: 'التوصيل السريع', value: extraFee(z.expressFee), tone: z.expressFee === null ? 'muted' : 'good' },
          { label: 'التوصيل في موعد', value: extraFee(z.scheduledFee), tone: z.scheduledFee === null ? 'muted' : 'good' },
        ],
      },
    ],
  };
}
