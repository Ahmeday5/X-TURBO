import { EntityDetails } from '../../../shared/components/details-drawer/details-drawer.model';
import { formatInteger } from '../../../shared/utils/format.util';
import { CarMake, CarModel, modelYearsLabel } from '../models/car.model';

/** Car make details — built from the list row (the API has no GET /car-makes/{id}). */
export function toCarMakeDetails(m: CarMake): EntityDetails {
  return {
    header: {
      title: m.name,
      subtitle: m.nameEn ?? undefined,
      icon: 'car',
      badge: m.isActive ? { label: 'نشطة', tone: 'good' } : { label: 'موقوفة', tone: 'neutral' },
    },
    sections: [
      {
        title: 'بيانات الماركة',
        icon: 'car',
        fields: [
          { label: 'الاسم بالعربي', value: m.name },
          { label: 'الاسم بالإنجليزي', value: m.nameEn, ltr: true },
          { label: 'عدد الموديلات', value: formatInteger(m.modelsCount) },
          { label: 'ترتيب العرض في التطبيق', value: formatInteger(m.sortOrder) },
          { label: 'الظهور في التطبيق', value: m.isActive ? 'ظاهرة' : 'مخفية', tone: m.isActive ? 'good' : 'muted' },
        ],
      },
    ],
  };
}

/** Car model details — built from the list row (the API has no GET /car-models/{id}). */
export function toCarModelDetails(m: CarModel): EntityDetails {
  return {
    header: {
      title: `${m.makeName} ${m.name}`,
      subtitle: modelYearsLabel(m),
      icon: 'car',
      badge: m.isActive ? { label: 'نشط', tone: 'good' } : { label: 'موقوف', tone: 'neutral' },
    },
    sections: [
      {
        title: 'بيانات الموديل',
        icon: 'car',
        fields: [
          { label: 'الماركة', value: m.makeName },
          { label: 'الموديل', value: m.name },
          { label: 'الاسم بالإنجليزي', value: m.nameEn, ltr: true },
          { label: 'سنوات الإنتاج', value: modelYearsLabel(m), ltr: true },
          { label: 'من سنة', value: m.yearFrom, ltr: true },
          { label: 'إلى سنة', value: m.yearTo ?? 'لا يزال يُصنَّع', ltr: !!m.yearTo },
          { label: 'الظهور في التطبيق', value: m.isActive ? 'ظاهر' : 'مخفي', tone: m.isActive ? 'good' : 'muted' },
        ],
      },
    ],
  };
}
