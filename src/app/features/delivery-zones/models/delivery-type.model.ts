import { IconName } from '../../../shared/components/icon/icon.component';

/**
 * Delivery options a mobile-app customer picks at checkout:
 *   - `standard`  — the zone's normal fee and day estimate;
 *   - `express`   — faster, at the zone's `expressFee`;
 *   - `scheduled` — the customer books a one-hour slot, at the zone's `scheduledFee`.
 * Express / scheduled exist in a governorate only when its zone has a fee for
 * them AND they're switched on in the delivery settings.
 */
export type DeliveryType = 'standard' | 'express' | 'scheduled';

export const DELIVERY_TYPES: readonly DeliveryType[] = ['standard', 'express', 'scheduled'];

/** One bookable hour, e.g. 10:00–11:00 on 2026-11-24. */
export interface DeliverySlot {
  /** Stable key, e.g. `2026-11-24_10-11`. */
  id: string;
  /** Cairo calendar day, `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`, 24-hour. */
  from: string;
  to: string;
  /** Server-built Arabic label: "الثلاثاء 24/11 — من 10 ص إلى 11 ص". */
  label: string;
}

/** How an order is delivered (`delivery` on every order row and on the full order). */
export interface OrderDelivery {
  type: DeliveryType;
  /** Server label ("عادي" / "سريع" / "حدد موعد") — shown as-is. */
  typeName: string;
  /** The booked hour — `null` unless `type` is `scheduled`. */
  slot: DeliverySlot | null;
}

export interface DeliveryTypeView {
  label: string;
  icon: IconName;
  /** CSS colour token of the badge. */
  color: string;
  /** Needs fast handling (prepare + assign a driver right away). */
  urgent: boolean;
}

/** Colour code shared by every screen: standard grey · express red · scheduled blue. */
export const DELIVERY_TYPE_VIEW: Record<DeliveryType, DeliveryTypeView> = {
  standard: { label: 'عادي', icon: 'truck', color: 'var(--txt3)', urgent: false },
  express: { label: 'سريع', icon: 'bolt', color: 'var(--re)', urgent: true },
  scheduled: { label: 'حدد موعد', icon: 'calendar', color: 'var(--bl)', urgent: false },
};

/** View of a delivery as sent by the server — a type this build doesn't know falls back to "standard" styling. */
export function deliveryView(d: Pick<OrderDelivery, 'type' | 'typeName'>): DeliveryTypeView {
  const known = DELIVERY_TYPE_VIEW[d.type as DeliveryType] as DeliveryTypeView | undefined;
  const base = known ?? DELIVERY_TYPE_VIEW.standard;
  return { ...base, label: d.typeName || base.label };
}

export const isExpress = (d: Pick<OrderDelivery, 'type'> | null | undefined): boolean => d?.type === 'express';

// ── Hours (slots are whole hours, 0–24) ──

/** "10 ص" · "12 م" · "10 م" · 0 / 24 → "12 ص". */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${h < 12 ? 'ص' : 'م'}`;
}

/** `"10:00"` → 10 (minutes are always `00` for slots). */
export const parseHour = (hhmm: string): number => Number.parseInt(hhmm.slice(0, 2), 10);

/** "10 ص – 11 ص" for a slot or an hour range. */
export function hourRangeLabel(from: number, to: number): string {
  return `${hourLabel(from)} – ${hourLabel(to)}`;
}

/** Short time part of a slot ("10 ص – 11 ص"); the full `label` carries the day too. */
export const slotTimeLabel = (s: Pick<DeliverySlot, 'from' | 'to'>): string =>
  hourRangeLabel(parseHour(s.from), parseHour(s.to));
