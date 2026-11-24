import { inject, Injectable, signal } from '@angular/core';
import { StorageService } from '../../../core/services/storage.service';

const SHOW_IMAGES_KEY = 'xturbo.documents.print.show-images';

/**
 * Document print preferences, per device: an A4 office printer wants the
 * product photos, a thermal printer at the warehouse door doesn't.
 */
@Injectable({ providedIn: 'root' })
export class DocumentPrintSettingsService {
  private readonly storage = inject(StorageService);

  private readonly _showImages = signal(this.storage.get(SHOW_IMAGES_KEY) !== 'false');
  /** Print a small photo on each line. On by default. */
  readonly showImages = this._showImages.asReadonly();

  setShowImages(on: boolean): void {
    this._showImages.set(on);
    this.storage.set(SHOW_IMAGES_KEY, String(on));
  }
}
