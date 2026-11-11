import { EntityDetails } from '../../../shared/components/details-drawer/details-drawer.model';
import { formatMoney } from '../../../shared/utils/format.util';
import { deliveryDaysLabel, DeliveryZone } from '../models/delivery-zone.model';

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
            label: 'الشحن المجاني',
            value: z.freeShippingThreshold ? `للطلبات من ${formatMoney(z.freeShippingThreshold)}` : 'غير متاح',
          },
          {
            label: 'الحالة في التطبيق',
            value: z.isActive ? 'التوصيل متاح' : 'لا يوجد توصيل لهذه المحافظة',
            tone: z.isActive ? 'good' : 'warning',
          },
        ],
      },
    ],
  };
}
