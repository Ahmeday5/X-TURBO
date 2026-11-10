import { PagedResponse } from '../../../core/models/api-response.model';
import { ListQuery } from '../../../core/models/list-query.model';
import { FilterOption } from '../../../shared/components/filter-select/filter-select.component';

/**
 * Customer reviews of an item, left from the mobile app after delivery.
 * `GET /items/{id}/reviews` · `PUT /items/{id}/reviews/{reviewId}/visibility` (`Items.View`).
 */
export interface ItemReview {
  id: string;
  /** 1–5. */
  rating: number;
  comment: string | null;
  customerId: string;
  customerName: string;
  /** International format, e.g. "+201012345678". */
  customerPhone: string;
  orderId: string | null;
  orderNumber: string | null;
  /** The customer actually bought this item. */
  isVerifiedPurchase: boolean;
  /** Hidden reviews don't show in the app and don't count in the average. */
  isHidden: boolean;
  hiddenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RatingBucket {
  rating: number;
  count: number;
}

/** Whole-item summary — NOT affected by the list filters. */
export interface ReviewsSummary {
  /** Visible reviews only, 1 decimal. */
  averageRating: number;
  /** Visible reviews. */
  reviewsCount: number;
  hiddenCount: number;
  withCommentCount: number;
  distribution: RatingBucket[];
}

export interface ItemReviewsResponse {
  itemId: string;
  itemCode: string;
  itemName: string;
  summary: ReviewsSummary;
  reviews: PagedResponse<ItemReview>;
}

export interface ReviewVisibilityPayload {
  isHidden: boolean;
  reason?: string | null;
}

export const HIDE_REASON_MAX = 200;

/** URL filter keys of the reviews list (kept short; shared with the item screen's query string). */
export const REVIEW_FILTERS = ['stars', 'visibility', 'hasComment', 'from', 'to'] as const;

/** `stars` filter value for "negative" (≤ 2★). */
export const NEGATIVE_STARS = 'neg';

export const STAR_FILTER_OPTIONS: readonly FilterOption[] = [
  { value: '5', label: '★★★★★ 5' },
  { value: '4', label: '★★★★ 4' },
  { value: '3', label: '★★★ 3' },
  { value: '2', label: '★★ 2' },
  { value: '1', label: '★ 1' },
  { value: NEGATIVE_STARS, label: 'سلبية (2 أو أقل)' },
];

export const VISIBILITY_FILTER_OPTIONS: readonly FilterOption[] = [
  { value: 'visible', label: 'ظاهر' },
  { value: 'hidden', label: 'مخفي' },
];

/** The list query (URL state) → API query params. */
export function reviewQueryParams(query: ListQuery): Record<string, unknown> {
  const f = query.filters;
  const stars = f['stars'];
  return {
    pageIndex: query.pageIndex,
    pageSize: query.pageSize,
    search: query.search,
    sortBy: query.sort?.key,
    sortDir: query.sort?.dir,
    rating: stars && stars !== NEGATIVE_STARS ? stars : undefined,
    maxRating: stars === NEGATIVE_STARS ? 2 : undefined,
    visibility: f['visibility'],
    hasComment: f['hasComment'] === 'true' ? 'true' : undefined,
    from: f['from'],
    to: f['to'],
  };
}

/** Edited after it was first posted (a second apart or more). */
export function isEdited(r: Pick<ItemReview, 'createdAt' | 'updatedAt'>): boolean {
  return Math.abs(Date.parse(r.updatedAt) - Date.parse(r.createdAt)) >= 1000;
}
