import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { finalize } from 'rxjs';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import {
  formatFileSize,
  ITEM_IMAGE_ERROR_CODES,
  ITEM_IMAGE_RULES,
  ItemImage,
  imageFileProblem,
} from '../../models/item-image.model';
import { ItemImagesService } from '../../services/item-images.service';

type UploadStatus = 'queued' | 'uploading' | 'error';

/** A picked file waiting for / during / failed upload (successful ones join `images`). */
interface UploadTask {
  key: number;
  file: File;
  /** Object URL for the local preview — revoked when the task leaves the queue. */
  previewUrl: string | null;
  status: UploadStatus;
  /** 0–100 when the transport reports it; `null` = indeterminate. */
  percent: number | null;
  error: string | null;
}

let taskKey = 0;

/**
 * Store photos of one item: pick or drop files (validated locally first),
 * preview, sequential upload with per-file status, drag & drop reorder (or
 * the arrow buttons), primary star, delete. Max 10 images, JPG/PNG/WEBP ≤ 5 MB.
 */
@Component({
  selector: 'app-item-images',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './item-images.component.html',
  styleUrl: './item-images.component.scss',
})
export class ItemImagesComponent {
  private readonly api = inject(ItemImagesService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly itemId = input.required<string>();

  protected readonly rules = ITEM_IMAGE_RULES;
  protected readonly fileSize = formatFileSize;

  protected readonly images = signal<ItemImage[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly queue = signal<UploadTask[]>([]);
  protected readonly busyId = signal<string | null>(null);
  protected readonly dropActive = signal(false);
  /** Image being dragged for reordering. */
  protected readonly draggingId = signal<string | null>(null);

  protected readonly pending = computed(() => this.queue().filter((t) => t.status !== 'error').length);
  protected readonly uploadingIndex = computed(() => {
    const active = this.queue().filter((t) => t.status !== 'error');
    const i = active.findIndex((t) => t.status === 'uploading');
    return i < 0 ? null : { current: i + 1, total: active.length };
  });
  protected readonly slotsLeft = computed(() => ITEM_IMAGE_RULES.maxPerItem - this.images().length - this.pending());

  constructor() {
    effect(() => {
      const id = this.itemId();
      untracked(() => this.load(id));
    });
    inject(DestroyRef).onDestroy(() => this.queue().forEach((t) => this.revoke(t)));
  }

  // ── Load ──

  protected load(itemId = this.itemId()): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .list(itemId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => this.images.set(sortImages(list)),
        error: (err: ApiError) => this.loadError.set(err.message || 'تعذّر تحميل الصور'),
      });
  }

  // ── Pick / drop files ──

  protected onFilesPicked(input: HTMLInputElement): void {
    if (input.files?.length) this.addFiles(Array.from(input.files));
    input.value = ''; // allow re-picking the same file
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dropActive.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dropActive.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) this.addFiles(files);
  }

  private addFiles(files: File[]): void {
    let slots = this.slotsLeft();
    const tasks = files.map<UploadTask>((file) => {
      const problem = imageFileProblem(file) ?? (slots <= 0 ? `الحد الأقصى ${ITEM_IMAGE_RULES.maxPerItem} صور للصنف` : null);
      if (!problem) slots--;
      return {
        key: ++taskKey,
        file,
        previewUrl: problem ? null : URL.createObjectURL(file),
        status: problem ? 'error' : 'queued',
        percent: null,
        error: problem,
      };
    });
    this.queue.update((q) => [...q, ...tasks]);
    this.uploadNext();
  }

  protected dismiss(task: UploadTask): void {
    this.revoke(task);
    this.queue.update((q) => q.filter((t) => t.key !== task.key));
  }

  protected retry(task: UploadTask): void {
    if (imageFileProblem(task.file) || this.slotsLeft() <= 0) return;
    this.patchTask(task.key, { status: 'queued', error: null, percent: null, previewUrl: task.previewUrl ?? URL.createObjectURL(task.file) });
    this.uploadNext();
  }

  // ── Sequential upload (one request per image, per the API) ──

  private uploadNext(): void {
    if (this.queue().some((t) => t.status === 'uploading')) return;
    const next = this.queue().find((t) => t.status === 'queued');
    if (!next) {
      // Queue drained: re-read for the server's order / primary flag.
      if (!this.queue().length) this.load();
      return;
    }

    this.patchTask(next.key, { status: 'uploading' });
    this.api.upload(this.itemId(), next.file).subscribe({
      next: (event) => {
        if (event.kind === 'progress') {
          this.patchTask(next.key, { percent: event.percent });
          return;
        }
        this.images.update((list) => sortImages([...list, event.value]));
        this.dismiss(next);
      },
      error: (err: ApiError) => {
        this.patchTask(next.key, { status: 'error', error: err.message || 'تعذّر رفع الصورة' });
        // The item is full server-side: everything still queued would fail the same way.
        if (hasErrorCode(err, ITEM_IMAGE_ERROR_CODES.tooMany)) {
          this.queue.update((q) => q.map((t) => (t.status === 'queued' ? { ...t, status: 'error', error: err.message } : t)));
        }
        this.uploadNext();
      },
      complete: () => this.uploadNext(),
    });
  }

  // ── Existing images ──

  protected async remove(image: ItemImage, index: number): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'حذف الصورة',
      message: image.isPrimary
        ? 'هذه هي الصورة الرئيسية للصنف في التطبيق. سيتم حذفها نهائيًا. هل تريد المتابعة؟'
        : `سيتم حذف الصورة رقم ${index + 1} نهائيًا. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    this.busyId.set(image.id);
    this.api
      .remove(this.itemId(), image.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe(() => {
        this.toast.success('تم حذف الصورة');
        this.load(); // the server may promote another image to primary
      });
  }

  protected setPrimary(image: ItemImage): void {
    if (image.isPrimary) return;
    const previous = this.images();
    this.images.set(previous.map((i) => ({ ...i, isPrimary: i.id === image.id })));
    this.busyId.set(image.id);
    this.api
      .setPrimary(this.itemId(), image.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => this.toast.success('تم تعيين الصورة الرئيسية — تظهر على كارت المنتج في التطبيق'),
        error: () => this.images.set(previous),
      });
  }

  // ── Reorder (drag & drop, or arrows for keyboard users) ──

  protected onImageDragStart(event: DragEvent, image: ItemImage): void {
    this.draggingId.set(image.id);
    event.dataTransfer?.setData('text/plain', image.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onImageDragOver(event: DragEvent): void {
    if (this.draggingId()) event.preventDefault();
  }

  protected onImageDrop(event: DragEvent, target: ItemImage): void {
    const dragged = this.draggingId();
    this.draggingId.set(null);
    if (!dragged || dragged === target.id) return;
    event.preventDefault();
    event.stopPropagation();
    const list = this.images();
    const from = list.findIndex((i) => i.id === dragged);
    const to = list.findIndex((i) => i.id === target.id);
    this.move(from, to);
  }

  protected onImageDragEnd(): void {
    this.draggingId.set(null);
  }

  protected shift(index: number, delta: -1 | 1): void {
    this.move(index, index + delta);
  }

  private move(from: number, to: number): void {
    const previous = this.images();
    if (from < 0 || to < 0 || from >= previous.length || to >= previous.length || from === to) return;
    const next = [...previous];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    this.images.set(next.map((img, i) => ({ ...img, sortOrder: i })));
    this.api.reorder(this.itemId(), next.map((i) => i.id)).subscribe({
      error: () => this.images.set(previous), // the interceptor already toasted why
    });
  }

  // ── Helpers ──

  private patchTask(key: number, patch: Partial<UploadTask>): void {
    this.queue.update((q) => q.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  private revoke(task: UploadTask): void {
    if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
  }
}

function sortImages(list: readonly ItemImage[]): ItemImage[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
}
