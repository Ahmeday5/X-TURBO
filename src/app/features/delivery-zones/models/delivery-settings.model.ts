import { DeliverySlot, hourRangeLabel } from './delivery-type.model';

/**
 * Express / scheduled delivery options of the mobile app — one record,
 * `GET` / `PUT /api/delivery-settings` (`Settings.Manage`). Fees are per
 * governorate (delivery zones); this record says whether each type is on and
 * how the bookable hours are built.
 */
export interface DeliverySettings {
  expressEnabled: boolean;
  /** Shown to the customer under "سريع", e.g. "خلال 24 ساعة". */
  expressEtaText: string;
  scheduledEnabled: boolean;
  /** First slot starts at this hour (0–23). */
  slotStartHour: number;
  /** Last slot ends at this hour (1–24, after the start). 10 → 22 = 10-11 … 21-22. */
  slotEndHour: number;
  /** Bookable days including today (1–30). */
  daysAhead: number;
  /** Orders per slot; `0` = unlimited. */
  slotCapacity: number;
  /** Minimum minutes between ordering and the slot start (0–1440). */
  leadMinutes: number;
  /** Days with no scheduled delivery: 0 = Sunday … 6 = Saturday. */
  closedDays: number[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export type DeliverySettingsPayload = Omit<DeliverySettings, 'updatedAt' | 'updatedBy'>;

/** A slot of the live preview (`GET /delivery-settings/slots`). */
export interface BookableSlot extends DeliverySlot {
  /** `false` = the slot reached its capacity. */
  available: boolean;
}

/** Limits — mirror the server's 422 rules. */
export const DELIVERY_SETTINGS_RULES = {
  etaMax: 60,
  hourMin: 0,
  hourMax: 24,
  daysAheadMin: 1,
  daysAheadMax: 30,
  capacityMin: 0,
  capacityMax: 1000,
  leadMin: 0,
  leadMax: 1440,
} as const;

export interface WeekDay {
  /** Server value: 0 = Sunday … 6 = Saturday. */
  value: number;
  label: string;
}

/** Saturday first — the working week as it's read in Egypt. Values are the server's (0 = Sunday). */
export const WEEK_DAYS: readonly WeekDay[] = [
  { value: 6, label: 'السبت' },
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الاثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
];

export const dayName = (value: number): string => WEEK_DAYS.find((d) => d.value === value)?.label ?? String(value);

/** 0, 1, … 24 for the hour pickers. */
export const HOUR_OPTIONS: readonly number[] = Array.from(
  { length: DELIVERY_SETTINGS_RULES.hourMax - DELIVERY_SETTINGS_RULES.hourMin + 1 },
  (_, i) => DELIVERY_SETTINGS_RULES.hourMin + i,
);

/** Hour slots a day offers, e.g. 10 → 22 = ["10 ص – 11 ص", …, "9 م – 10 م"]. Empty when the range is invalid. */
export function daySlotLabels(startHour: number, endHour: number): string[] {
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour) || endHour <= startHour) return [];
  return Array.from({ length: endHour - startHour }, (_, i) => hourRangeLabel(startHour + i, startHour + i + 1));
}

/** "60 دقيقة" · "ساعتان" · "1 ساعة و30 دقيقة" — the lead time in words. */
export function leadTimeLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'بدون حد أدنى';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : `${h} ساعات`;
  if (!h) return `${m} دقيقة`;
  return m ? `${hours} و${m} دقيقة` : hours;
}

/** The live slots grouped by day, in server order. */
export interface SlotDay {
  date: string;
  slots: BookableSlot[];
  available: number;
}

export function groupSlotsByDay(slots: readonly BookableSlot[]): SlotDay[] {
  const days = new Map<string, SlotDay>();
  for (const s of slots) {
    const day = days.get(s.date) ?? { date: s.date, slots: [], available: 0 };
    day.slots.push(s);
    if (s.available) day.available++;
    days.set(s.date, day);
  }
  return [...days.values()];
}

export const DELIVERY_SETTINGS_MESSAGES = {
  endBeforeStart: 'نهاية مواعيد التوصيل يجب أن تكون بعد البداية',
  allDaysClosed: 'لا يمكن إغلاق كل أيام الأسبوع',
} as const;
