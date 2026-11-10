import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { ItemStore, ItemStorePayload } from '../models/item-store.model';

/** An item's mobile-store settings (`Items.View`). */
@Injectable({ providedIn: 'root' })
export class ItemStoreService {
  private readonly api = inject(ApiService);

  get(itemId: string): Observable<ItemStore> {
    return this.api.get<ItemStore>(API_ENDPOINTS.items.store(itemId), { context: withSkipLoader() });
  }

  /** Replaces the whole record — `priceTiers` is the complete new list. */
  save(itemId: string, payload: ItemStorePayload): Observable<ItemStore> {
    return this.api.put<ItemStore>(API_ENDPOINTS.items.store(itemId), payload);
  }
}
