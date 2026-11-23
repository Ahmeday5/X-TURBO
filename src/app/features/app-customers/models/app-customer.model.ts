import { RowAction } from '../../../shared/models/row-action.model';
import { StatusView } from '../../../shared/models/status-tone.model';

/**
 * Customers who signed up from the mobile app — `/api/app-customers`
 * (`Customers.View`). A sign-up is `pending` (can't log in) until an admin
 * activates it; `blocked` signs the customer out and keeps them out until
 * reactivated. Customers from before this feature are all `active`.
 */
export type AppCustomerStatus = 'pending' | 'active' | 'blocked';

export interface AppCustomer {
  id: string;
  name: string;
  /** International form, e.g. `+201012345678`. */
  phone: string;
  email: string | null;
  governorate: string;
  latitude: number | null;
  longitude: number | null;
  status: AppCustomerStatus;
  /** Entered the SMS code. An unverified customer can't be activated (409 `PHONE_NOT_VERIFIED`). */
  phoneVerified: boolean;
  /** Their account in "العملاء والموردين" — created on activation. */
  partyId: string | null;
  partyCode: string | null;
  ordersCount: number;
  /** Devices registered for push notifications. */
  devices: number;
  lastLoginAt: string | null;
  /** Who changed the status last, and when (`null` = never changed). */
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppCustomerStats {
  total: number;
  pending: number;
  active: number;
  blocked: number;
}

/** Statuses an admin can set (`pending` is only ever the sign-up state). */
export type AppCustomerTargetStatus = Exclude<AppCustomerStatus, 'pending'>;

export const APP_CUSTOMER_STATUSES: readonly AppCustomerStatus[] = ['pending', 'active', 'blocked'];

/** Chip colours: pending yellow · active green · blocked red. */
export const APP_CUSTOMER_STATUS_VIEW: Record<AppCustomerStatus, StatusView> = {
  pending: { label: 'قيد المراجعة', tone: 'warning', color: 'var(--am)' },
  active: { label: 'مفعّل', tone: 'good', color: 'var(--gr)' },
  blocked: { label: 'محظور', tone: 'danger', color: 'var(--re)' },
};

/** A status this build doesn't know yet is shown as-is, neutral. */
export function appCustomerStatusView(status: string): StatusView {
  return APP_CUSTOMER_STATUS_VIEW[status as AppCustomerStatus] ?? { label: status, tone: 'neutral', color: 'var(--txt3)' };
}

/** Business-rule codes of `POST /app-customers/{id}/status`. */
export const APP_CUSTOMER_ERROR_CODES = {
  /** 409 — the customer hasn't confirmed their phone (SMS code), so can't be activated. */
  phoneNotVerified: 'PHONE_NOT_VERIFIED',
  /** 422 — unknown target status. */
  invalidStatus: 'INVALID_STATUS',
} as const;

export const APP_CUSTOMER_SORT_KEYS = ['name', 'phone', 'governorate', 'status', 'lastLoginAt', 'statusChangedAt', 'createdAt'] as const;

// ── Actions (same list for a table row and the details drawer) ──

export type AppCustomerAction = 'activate' | 'block' | 'unblock';

/** Status each action sets. */
export const ACTION_TARGET: Record<AppCustomerAction, AppCustomerTargetStatus> = {
  activate: 'active',
  unblock: 'active',
  block: 'blocked',
};

/** pending → تفعيل + حظر · active → حظر · blocked → فك الحظر. */
export function appCustomerActions(c: Pick<AppCustomer, 'status' | 'phoneVerified'>): RowAction<AppCustomerAction>[] {
  switch (c.status) {
    case 'pending':
      return [
        {
          key: 'activate',
          label: 'تفعيل',
          icon: 'user-check',
          ...(c.phoneVerified ? { tone: 'primary' as const } : { disabledReason: 'لم يؤكد رقم الموبايل بعد' }),
        },
        { key: 'block', label: 'حظر', icon: 'user-x', tone: 'danger' },
      ];
    case 'active':
      return [{ key: 'block', label: 'حظر', icon: 'user-x', tone: 'danger' }];
    case 'blocked':
      return [{ key: 'unblock', label: 'فك الحظر', icon: 'user-check' }];
    default:
      return [];
  }
}

/** Google Maps link of the customer's saved location, or `null`. */
export function mapsUrl(c: Pick<AppCustomer, 'latitude' | 'longitude'>): string | null {
  if (c.latitude === null || c.longitude === null || c.latitude === undefined || c.longitude === undefined) return null;
  return `https://www.google.com/maps?q=${c.latitude},${c.longitude}`;
}
