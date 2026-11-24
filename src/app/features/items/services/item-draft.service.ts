import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { catchError, concatMap, defer, finalize, from, map, Observable, of, tap, toArray } from 'rxjs';
import { ApiError } from '../../../core/models/api-response.model';
import { apiErrorToMessage } from '../../../core/utils/api-error.util';
import { uploadResult } from '../../../shared/media/image-file.util';
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

/** Where one draft image is while the new item's images go up. */
export type DraftUploadStatus = 'queued' | 'uploading' | 'done' | 'error';

export interface DraftUploadState {
  status: DraftUploadStatus;
  /** 0–100 when the transport reports it; `null` = indeterminate. */
  percent: number | null;
  /** Server message (ready Arabic) when the upload failed. */
  error: string | null;
}

/** Overall image upload progress during a commit ("الصورة 2 من 3 — 45%"). */
export interface DraftUploadProgress {
  /** 1-based index of the image going up now. */
  current: number;
  total: number;
  percent: number | null;
}

/** What could not be saved after the item itself was created. */
export type DraftPart = 'images' | 'store' | 'fitments';

export interface DraftCommitResult {
  failed: DraftPart[];
  /** First server message per failed part — shown to the user as-is. */
  errors: Partial<Record<DraftPart, string>>;
}

export const DRAFT_PART_LABEL: Record<DraftPart, string> = {
  images: 'الصور',
  store: 'بيانات المتجر',
  fitments: 'التوافق مع السيارات',
};

/** A failed commit step, with the server's message. `null` = the step succeeded. */
interface StepFailure {
  part: DraftPart;
  message: string;
}
type StepOutcome = StepFailure | null;

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
  /** Per-image upload state, keyed by `DraftImage.key` — filled only while / after committing. */
  private readonly _uploads = signal<ReadonlyMap<number, DraftUploadState>>(new Map());
  readonly uploads = this._uploads.asReadonly();
  /** True while the draft is being applied to a freshly created item — the draft is read-only then. */
  private readonly _committing = signal(false);
  readonly committing = this._committing.asReadonly();

  readonly uploadProgress = computed<DraftUploadProgress | null>(() => {
    const images = this._images();
    const uploads = this._uploads();
    const index = images.findIndex((img) => uploads.get(img.key)?.status === 'uploading');
    if (index < 0) return null;
    return { current: index + 1, total: images.length, percent: uploads.get(images[index].key)?.percent ?? null };
  });

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
    if (this._committing()) return 0;
    const room = ITEM_IMAGE_RULES.maxPerItem - this._images().length;
    const accepted = files.slice(0, Math.max(0, room)).map((file) => ({ key: ++draftKey, file, previewUrl: URL.createObjectURL(file) }));
    this._images.update((list) => [...list, ...accepted]);
    return accepted.length;
  }

  removeImage(key: number): void {
    if (this._committing()) return;
    const img = this._images().find((i) => i.key === key);
    if (img) URL.revokeObjectURL(img.previewUrl);
    this._images.update((list) => list.filter((i) => i.key !== key));
  }

  moveImage(from: number, to: number): void {
    if (this._committing()) return;
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

  /**
   * Applies everything to the freshly created item. Never errors — failures
   * are listed with the server's message. The item is NOT re-created on
   * failure (that would answer BARCODE_TAKEN / SKU_TAKEN): the caller sends
   * the user to edit mode to finish.
   */
  commit(itemId: string): Observable<DraftCommitResult> {
    const steps: Observable<StepOutcome>[] = [];

    const images = this._images();
    if (images.length) steps.push(this.uploadImages(itemId, images));

    const store = this._store();
    if (store && (store.isPublished || store.isFastDelivery || store.priceTiers.length)) {
      steps.push(this.attempt(this.storeApi.save(itemId, store), 'store'));
    }

    const fitments = this._fitments();
    if (fitments.length) steps.push(this.attempt(this.fitmentsApi.replace(itemId, fitments.map(toFitmentPayload)), 'fitments'));

    if (!steps.length) return of({ failed: [], errors: {} });
    return defer(() => {
      this._committing.set(true);
      return from(steps).pipe(
        concatMap((step) => step),
        toArray(),
        map((outcomes) => {
          const failed = outcomes.filter((o): o is StepFailure => o !== null);
          return {
            failed: failed.map((f) => f.part),
            errors: Object.fromEntries(failed.map((f) => [f.part, f.message])) as DraftCommitResult['errors'],
          };
        }),
        finalize(() => this._committing.set(false)),
      );
    });
  }

  reset(): void {
    for (const img of this._images()) URL.revokeObjectURL(img.previewUrl);
    this._images.set([]);
    this._uploads.set(new Map());
    this._store.set(null);
    this._storeValid.set(true);
    this._fitments.set([]);
  }

  ngOnDestroy(): void {
    for (const img of this._images()) URL.revokeObjectURL(img.previewUrl);
  }

  // ── Internals ──

  /**
   * Uploads one image per request, in the chosen order, tracking each one's
   * progress; then makes the first uploaded one primary (the server already
   * does for the item's first image — this covers a failed first upload).
   * One failure doesn't stop the rest: every image gets its chance.
   */
  private uploadImages(itemId: string, images: readonly DraftImage[]): Observable<StepOutcome> {
    const uploaded: ItemImage[] = [];
    let firstError: string | null = null;
    return defer(() => {
      this._uploads.set(new Map(images.map((img) => [img.key, { status: 'queued', percent: null, error: null }])));
      return from(images).pipe(
        concatMap((img) => {
          this.patchUpload(img.key, { status: 'uploading', percent: null });
          return this.imagesApi.upload(itemId, img.file).pipe(
            tap((event) => {
              if (event.kind === 'progress') this.patchUpload(img.key, { percent: event.percent });
            }),
            uploadResult(),
            tap((image) => {
              uploaded.push(image);
              this.patchUpload(img.key, { status: 'done', percent: 100 });
            }),
            catchError((err: ApiError) => {
              const message = apiErrorToMessage(err, 'تعذّر رفع الصورة');
              firstError ??= message;
              this.patchUpload(img.key, { status: 'error', error: message });
              return of(null);
            }),
          );
        }),
        toArray(),
        concatMap(() =>
          uploaded.length && !uploaded[0].isPrimary
            ? this.imagesApi.setPrimary(itemId, uploaded[0].id).pipe(catchError(() => of(null)))
            : of(null),
        ),
        map((): StepOutcome => (firstError ? { part: 'images', message: firstError } : null)),
      );
    });
  }

  private attempt(request: Observable<unknown>, part: DraftPart): Observable<StepOutcome> {
    return defer(() => request).pipe(
      map((): StepOutcome => null),
      catchError((err: ApiError) => of<StepOutcome>({ part, message: apiErrorToMessage(err, 'تعذّر الحفظ') })),
    );
  }

  private patchUpload(key: number, patch: Partial<DraftUploadState>): void {
    this._uploads.update((map) => {
      const next = new Map(map);
      const current = next.get(key) ?? { status: 'queued', percent: null, error: null };
      next.set(key, { ...current, ...patch });
      return next;
    });
  }
}
