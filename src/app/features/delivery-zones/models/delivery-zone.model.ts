import { ArabicPluralForms, pluralAr } from '../../../shared/utils/plural.util';

/**
 * Shipping terms for one governorate (mobile-app orders). One zone per
 * governorate; a governorate without an ACTIVE zone has no delivery in the app.
 * Contract: `/api/delivery-zones` (`Settings.Manage`).
 */
export interface DeliveryZone {
  id: string;
  /** Matched by name against the customer's governorate — keep the canonical spelling (EGYPT_GOVERNORATES). */
  governorate: string;
  fee: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  /** Order total from which shipping is free; `null` = never free. */
  freeShippingThreshold: number | null;
  isActive: boolean;
}

export interface DeliveryZonePayload {
  governorate: string;
  fee: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  freeShippingThreshold?: number | null;
  isActive?: boolean;
}

/** Business-rule codes the delivery-zones API answers with (409). */
export const DELIVERY_ZONE_ERROR_CODES = {
  /** That governorate already has a zone. */
  duplicate: 'DUPLICATE_ZONE',
  /** Zone is referenced by orders — deactivate it instead of deleting. */
  inUse: 'ZONE_IN_USE',
} as const;

/**
 * Egypt's 27 governorates, canonical Arabic spelling, north → south. The same
 * spelling must be used by the mobile app (zones match orders by name).
 */
export const EGYPT_GOVERNORATES: readonly string[] = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'القليوبية',
  'الشرقية',
  'الدقهلية',
  'الغربية',
  'المنوفية',
  'البحيرة',
  'كفر الشيخ',
  'دمياط',
  'بورسعيد',
  'الإسماعيلية',
  'السويس',
  'الفيوم',
  'بني سويف',
  'المنيا',
  'أسيوط',
  'سوهاج',
  'قنا',
  'الأقصر',
  'أسوان',
  'البحر الأحمر',
  'الوادي الجديد',
  'مطروح',
  'شمال سيناء',
  'جنوب سيناء',
];

const DAYS: ArabicPluralForms = { zero: 'نفس اليوم', one: 'يوم واحد', two: 'يومان', few: '# أيام', other: '# يومًا' };

/** "نفس اليوم" / "يومان" / "2–4 أيام". */
export function deliveryDaysLabel(min: number, max: number): string {
  if (min === max) return pluralAr(min, DAYS);
  if (min === 0) return `نفس اليوم – ${pluralAr(max, DAYS)}`;
  // Unit agrees with the upper bound: "1–2 يوم" · "2–4 أيام" · "3–14 يومًا".
  const unit = max <= 2 ? 'يوم' : max <= 10 ? 'أيام' : 'يومًا';
  return `${min}–${max} ${unit}`;
}

export function toZonePayload(z: DeliveryZone, patch: Partial<DeliveryZonePayload> = {}): DeliveryZonePayload {
  const { governorate, fee, estimatedDaysMin, estimatedDaysMax, freeShippingThreshold, isActive } = z;
  return { governorate, fee, estimatedDaysMin, estimatedDaysMax, freeShippingThreshold, isActive, ...patch };
}

/** Governorate order of the canonical list (unknown names last, alphabetically). */
export function governorateRank(name: string): number {
  const i = EGYPT_GOVERNORATES.indexOf(name);
  return i < 0 ? EGYPT_GOVERNORATES.length : i;
}
