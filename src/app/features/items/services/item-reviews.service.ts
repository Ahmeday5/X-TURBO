import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { ItemReview, ItemReviewsResponse, ReviewVisibilityPayload } from '../models/item-review.model';

/** Customer reviews of an item (`Items.View`). */
@Injectable({ providedIn: 'root' })
export class ItemReviewsService {
  private readonly api = inject(ApiService);

  /** Summary (whole item) + one page of reviews for `params` (see `reviewQueryParams`). */
  list(itemId: string, params: Record<string, unknown>): Observable<ItemReviewsResponse> {
    return this.api.get<ItemReviewsResponse>(API_ENDPOINTS.items.reviews(itemId), { params, context: withSkipLoader() });
  }

  /** Hide (with an optional reason) or show a review. Returns the updated review. */
  setVisibility(itemId: string, reviewId: string, payload: ReviewVisibilityPayload): Observable<ItemReview> {
    return this.api.put<ItemReview>(API_ENDPOINTS.items.reviewVisibility(itemId, reviewId), payload);
  }
}
