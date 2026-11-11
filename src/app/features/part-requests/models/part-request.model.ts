import { RowAction } from '../../../shared/models/row-action.model';
import { StatusView } from '../../../shared/models/status-tone.model';

/**
 * "Find me this part" requests sent from the mobile app with photos.
 * `/api/part-requests` (`Orders.View`). Quoting / rejecting notifies the customer.
 */
export type PartRequestStatus =
  | 'pending_review'
  | 'quoted'
  | 'accepted'
  | 'declined'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export interface PartRequestImage {
  id: string;
  /** Token-protected — load through `PartRequestsService.image()` as a blob. */
  url: string;
}

export interface PartRequest {
  id: string;
  /** "PR-00042". */
  number: string;
  status: PartRequestStatus;
  customerId: string;
  customerName: string;
  customerPhone: string;
  partName: string;
  details: string;
  /** Free text the customer typed, e.g. "تويوتا كورولا 2018". */
  carText: string;
  governorate: string;
  contactPhone: string;
  quotedPrice: number | null;
  quoteNotes: string;
  quotedAt: string | null;
  quoteValidUntil: string | null;
  quotedBy: string | null;
  rejectionReason: string | null;
  imagesCount: number;
  images: PartRequestImage[];
  createdAt: string;
}

export interface QuotePayload {
  price: number;
  notes?: string;
  /** How long the offer stays valid (days). */
  validDays?: number;
}

export interface RejectPayload {
  reason: string;
}

/** Business-rule codes (409): the request's current status doesn't allow it. */
export const PART_REQUEST_ERROR_CODES = {
  cannotQuote: 'CANNOT_QUOTE',
  cannotReject: 'CANNOT_REJECT',
} as const;

export const PART_REQUEST_STATUSES: readonly PartRequestStatus[] = [
  'pending_review',
  'quoted',
  'accepted',
  'declined',
  'rejected',
  'cancelled',
  'expired',
];

export const PART_REQUEST_STATUS_VIEW: Record<PartRequestStatus, StatusView & { hint: string }> = {
  pending_review: { label: 'جديد', tone: 'warning', color: 'var(--am)', hint: 'بانتظار المراجعة وإرسال عرض سعر أو الرفض' },
  quoted: { label: 'تم إرسال عرض', tone: 'info', color: 'var(--bl)', hint: 'بانتظار رد العميل على العرض' },
  accepted: { label: 'قبِل العميل', tone: 'good', color: 'var(--gr)', hint: 'العميل قبِل العرض — تواصل معه لإتمام البيع' },
  declined: { label: 'رفض العميل', tone: 'neutral', color: 'var(--txt3)', hint: 'العميل رفض العرض' },
  rejected: { label: 'مرفوض', tone: 'danger', color: 'var(--re)', hint: 'تعذّر توفير القطعة' },
  cancelled: { label: 'ألغاه العميل', tone: 'neutral', color: 'var(--txt3)', hint: 'العميل ألغى الطلب' },
  expired: { label: 'منتهي', tone: 'neutral', color: 'var(--txt3)', hint: 'انتهت صلاحية العرض دون رد' },
};

/** Actions are offered only while the request awaits review (the API answers 409 otherwise). */
export const canAnswer = (r: Pick<PartRequest, 'status'>): boolean => r.status === 'pending_review';

export type PartRequestAction = 'quote' | 'reject';

/** What can be done to a request — the same list for its table row and its drawer. */
export function partRequestActions(r: Pick<PartRequest, 'status'>): RowAction<PartRequestAction>[] {
  if (!canAnswer(r)) return [];
  return [
    { key: 'quote', label: 'إرسال عرض سعر', icon: 'tag', tone: 'primary' },
    { key: 'reject', label: 'رفض الطلب', icon: 'x', tone: 'danger', separated: true },
  ];
}

/** Quote form limits. */
export const QUOTE_RULES = { maxNotes: 500, minDays: 1, maxDays: 30, defaultDays: 3 } as const;
export const REJECT_REASON_MAX = 300;
