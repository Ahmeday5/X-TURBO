/**
 * Push notifications to mobile-app customers (Firebase) — `/api/notification-campaigns`
 * (`Customers.View`). A campaign is sent once; its delivery counters settle within
 * seconds (`pending` → 0), so the UI polls `GET /{id}` until then.
 */
export type CampaignTarget = 'all' | 'customers';

/** Screen the notification opens in the app. */
export type CampaignRefType = 'product' | 'category' | 'order';

export interface Campaign {
  id: string;
  title: string;
  body: string;
  target: CampaignTarget;
  refType: CampaignRefType | null;
  refId: string | null;
  /** Customers the campaign was addressed to. */
  recipientCount: number;
  /** Reached their phones. */
  sent: number;
  /** No device registered — they'll only see it inside the app. */
  noDevices: number;
  /** Rejected by Firebase. */
  failed: number;
  /** Still being sent (settles within seconds). */
  pending: number;
  /** Firebase isn't configured on the server — stored in-app only. */
  inAppOnly: number;
  /** Opened from inside the app. */
  readCount: number;
  createdByName: string;
  createdAt: string;
}

export interface SendCampaignPayload {
  title: string;
  body: string;
  target: CampaignTarget;
  /** Required when `target = customers` (1–1000). */
  customerIds?: string[];
  refType?: CampaignRefType;
  refId?: string;
}

/** A row of the recipient picker. */
export interface CampaignCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  governorate: string;
  isActive: boolean;
  phoneVerified: boolean;
  /** Registered devices; 0 → the push can't reach a phone. */
  fcmTokens: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export const CAMPAIGN_RULES = { titleMax: 150, bodyMax: 500, maxRecipients: 1000 } as const;

export const CAMPAIGN_ERROR_CODES = {
  /** 409 — no active customers to send to. */
  noRecipients: 'NO_RECIPIENTS',
} as const;

export const CAMPAIGN_TARGET_LABEL: Record<CampaignTarget, string> = {
  all: 'كل العملاء',
  customers: 'عملاء محددون',
};

export const CAMPAIGN_REF_TYPES: readonly CampaignRefType[] = ['product', 'category', 'order'];

export const CAMPAIGN_REF_LABEL: Record<CampaignRefType, string> = {
  product: 'منتج',
  category: 'تصنيف',
  order: 'طلب',
};

/** Delivery counters in display order, each a slice of the stacked bar. */
export const DELIVERY_SEGMENTS = [
  { key: 'sent', label: 'وصل للموبايل', color: 'var(--gr)' },
  { key: 'inAppOnly', label: 'داخل التطبيق فقط', color: 'var(--bl)' },
  { key: 'noDevices', label: 'بدون جهاز مسجّل', color: 'var(--txt3)' },
  { key: 'failed', label: 'فشل الإرسال', color: 'var(--re)' },
  { key: 'pending', label: 'جارٍ الإرسال', color: 'var(--am)' },
] as const satisfies readonly { key: keyof Campaign; label: string; color: string }[];

export type DeliverySegmentKey = (typeof DELIVERY_SEGMENTS)[number]['key'];

/** Still delivering → keep polling. */
export const isDelivering = (c: Pick<Campaign, 'pending'>): boolean => c.pending > 0;

/** Share of recipients who opened it (0–100). */
export const readRate = (c: Pick<Campaign, 'readCount' | 'recipientCount'>): number =>
  c.recipientCount ? Math.round((c.readCount / c.recipientCount) * 100) : 0;
