import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withNoTimeout, withSilentErrors, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService, UploadEvent } from '../../../core/services/api.service';
import { ItemImage } from '../models/item-image.model';

/** An item's store photos (`Items.View`). */
@Injectable({ providedIn: 'root' })
export class ItemImagesService {
  private readonly api = inject(ApiService);

  list(itemId: string): Observable<ItemImage[]> {
    return this.api.get<ItemImage[]>(API_ENDPOINTS.items.images(itemId), { context: withSkipLoader() });
  }

  /**
   * One image per request, multipart field `file` → 201 with the new image.
   * Errors are NOT toasted (the caller shows them on the file's tile) and the
   * global timeout is lifted (duration depends on file size / connection).
   */
  upload(itemId: string, file: File): Observable<UploadEvent<ItemImage>> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.upload<ItemImage>(API_ENDPOINTS.items.images(itemId), body, {
      context: withNoTimeout(withSilentErrors(withSkipLoader())),
    });
  }

  remove(itemId: string, imageId: string): Observable<void> {
    return this.api.delete<void>(API_ENDPOINTS.items.image(itemId, imageId));
  }

  /** Every image id, in the new order. */
  reorder(itemId: string, orderedIds: readonly string[]): Observable<unknown> {
    return this.api.put<unknown>(API_ENDPOINTS.items.imagesOrder(itemId), orderedIds, { context: withSkipLoader() });
  }

  setPrimary(itemId: string, imageId: string): Observable<unknown> {
    return this.api.post<unknown>(API_ENDPOINTS.items.imagePrimary(itemId, imageId), {}, { context: withSkipLoader() });
  }
}
