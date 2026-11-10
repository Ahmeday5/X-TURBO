import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { FitmentPayload, ItemFitment } from '../models/item-fitment.model';

/** Which car models an item fits (`Items.View`). */
@Injectable({ providedIn: 'root' })
export class ItemFitmentsService {
  private readonly api = inject(ApiService);

  list(itemId: string): Observable<ItemFitment[]> {
    return this.api.get<ItemFitment[]>(API_ENDPOINTS.items.fitments(itemId), { context: withSkipLoader() });
  }

  /** Replaces ALL of the item's fitments with `fitments`. */
  replace(itemId: string, fitments: readonly FitmentPayload[]): Observable<ItemFitment[] | null> {
    return this.api.put<ItemFitment[] | null>(API_ENDPOINTS.items.fitments(itemId), fitments);
  }
}
