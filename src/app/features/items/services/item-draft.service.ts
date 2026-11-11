import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { concatMap, defer, from, last, map, Observable, of, catchError, toArray } from 'rxjs';
import { ItemFitment, toFitmentPayload } from '../models/item-fitment.model';
import { ItemImage, ITEM_IMAGE_RULES } from '../models/item-image.model';
import { ItemStorePayload } from '../models/item-store.model';
import { ItemFitmentsService } from './item-fitments.service';
import { ItemImagesService } from './item-images.service';
import { ItemStoreService } from './item-store.service';

/** A picked image waiting for the item to exist. */
export interface DraftImage {
  key: number;
  file: File;
  /** Object URL for the preview — revoked when the image leaves the draft. */
  previewUrl: string;
}

/** What could not be saved after the item itself was created. */
export type DraftPart = 'images' | 'store' | 'fitments';

export interface DraftCommitResult {
  failed: DraftPart[];
}

export const DRAFT_PART_LABEL: Record<DraftPart, string> = {
  images: 'الصور',
  store: 'بيانات المتجر',
  fitments: 'التوافق مع السيارات',
};

let draftKey = 0;

/**
 * Holds what the user prepares on the image / store / fitment tabs of a NEW
 * item (those APIs need the item's id), then applies it right after the item
 * is created. Provided by the item screen, so it lives exactly as long as the
 * screen and survives tab switches.
 *
 * Commit order: images (one request each, in the chosen order; the first
 * becomes primary) → store data → fitments. A failing part never rolls back
 * the item: it is reported so the user can finish it in edit mode.
 */
@Injectable()
export class ItemDraftService implements OnDestroy {
  private readonly imagesApi = inject(ItemImagesService);
  private readonly storeApi = inject(ItemStoreService);
  private readonly fitmentsApi = inject(ItemFitmentsService);

  // ── Images ──
  private readonly _images = signal<DraftImage[]>([]);
  readonly images = this._images.asReadonly();

  // ── Store ──
  private readonly _store = signal<ItemStorePayload | null>(null);
  /** False while the store tab has invalid tiers — the item can't be saved yet. */
  private readonly _storeValid = signal(true);
  readonly store = this._store.asReadonly();
  readonly storeValid = this._storeValid.asReadonly();

  // ── Fitments ──
  private readonly _fitments = signal<ItemFitment[]>([]);
  readonly fitments = this._fitments.asReadonly();

  /** "3 صور · بيانات المتجر · 2 توافق" — shown next to the save button. */
  readonly pendingSummary = computed(() => {
    const parts: string[] = [];
    const n = this._images().length;
    if (n) parts.push(n === 1 ? 'صورة واحدة' : n === 2 ? 'صورتان' : `${n} صور`);
    const s = this._store();
    if (s && (s.isPublished || s.isFastDelivery || s.priceTiers.length)) parts.push('بيانات المتجر');
    const f = this._fitments().length;
    if (f) parts.push(`${f} توافق`);
    return parts.join(' · ');
  });

  // ── Images API ──

  /** Adds as many files as the per-item limit allows; returns how many were accepted. */
  addImages(files: readonly File[]): number {
    const room = ITEM_IMAGE_RULES.maxPerItem - this._images().length;
    const accepted = files.slice(0, Math.max(0, room)).map((file) => ({ key: ++draftKey, file, previewUrl: URL.createObjectURL(file) }));
    this._images.update((list) => [...list, ...accepted]);
    return accepted.length;
  }

  removeImage(key: number): void {
    const img = this._images().find((i) => i.key === key);
    if (img) URL.revokeObjectURL(img.previewUrl);
    this._images.update((list) => list.filter((i) => i.key !== key));
  }

  moveImage(from: number, to: number): void {
    const list = [...this._images()];
    if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    this._images.set(list);
  }

  // ── Store / fitments API ──

  setStore(payload: ItemStorePayload, valid: boolean): void {
    this._store.set(payload);
    this._storeValid.set(valid);
  }

  setFitments(list: readonly ItemFitment[]): void {
    this._fitments.set([...list]);
  }

  // ── Lifecycle ──

  /** Applies everything to the freshly created item. Never errors — failures are listed. */
  commit(itemId: string): Observable<DraftCommitResult> {
    const steps: Observable<DraftPart | null>[] = [];

    const images = this._images();
    if (images.length) steps.push(this.uploadImages(itemId, images).pipe(map((ok) => (ok ? null : 'images'))));

    const store = this._store();
    if (store && (store.isPublished || store.isFastDelivery || store.priceTiers.length)) {
      steps.push(this.attempt(this.storeApi.save(itemId, store), 'store'));
    }

    const fitments = this._fitments();
    if (fitments.length) steps.push(this.attempt(this.fitmentsApi.replace(itemId, fitments.map(toFitmentPayload)), 'fitments'));

    if (!steps.length) return of({ failed: [] });
    return from(steps).pipe(
      concatMap((step) => step),
      toArray(),
      map((results) => ({ failed: results.filter((r): r is DraftPart => r !== null) })),
    );
  }

  reset(): void {
    for (const img of this._images()) URL.revokeObjectURL(img.previewUrl);
    this._images.set([]);
    this._store.set(null);
    this._storeValid.set(true);
    this._fitments.set([]);
  }

  ngOnDestroy(): void {
    for (const img of this._images()) URL.revokeObjectURL(img.previewUrl);
  }

  // ── Internals ──

  /** Uploads in order, then makes the first one primary. `true` when every image went up. */
  private uploadImages(itemId: string, images: readonly DraftImage[]): Observable<boolean> {
    const uploaded: ItemImage[] = [];
    let failed = false;
    return from(images).pipe(
      concatMap((img) =>
        this.imagesApi.upload(itemId, img.file).pipe(
          last(),
          map((event) => {
            if (event.kind === 'done') uploaded.push(event.value);
          }),
          catchError(() => {
            failed = true;
            return of(undefined);
          }),
        ),
      ),
      toArray(),
      concatMap(() =>
        uploaded.length && !uploaded[0].isPrimary
          ? this.imagesApi.setPrimary(itemId, uploaded[0].id).pipe(catchError(() => of(null)))
          : of(null),
      ),
      map(() => !failed),
    );
  }

  private attempt(request: Observable<unknown>, part: DraftPart): Observable<DraftPart | null> {
    return defer(() => request).pipe(
      map(() => null),
      catchError(() => of(part)),
    );
  }
}
