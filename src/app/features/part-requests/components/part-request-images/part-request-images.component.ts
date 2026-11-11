import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { catchError, from, map, mergeMap, Observable, of, Subscription } from 'rxjs';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PartRequestImage } from '../../models/part-request.model';
import { PartRequestsService } from '../../services/part-requests.service';

type Slot = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error' };

/** Parallel downloads — enough to fill the grid quickly without flooding the API. */
const CONCURRENCY = 3;

/**
 * Gallery for the customer's photos. The files are token-protected, so each one
 * is fetched as a blob through the interceptors and shown via an object URL.
 * Every URL created here is revoked when the photos change or on destroy.
 */
@Component({
  selector: 'app-part-request-images',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ModalComponent],
  templateUrl: './part-request-images.component.html',
  styleUrl: './part-request-images.component.scss',
})
export class PartRequestImagesComponent {
  private readonly service = inject(PartRequestsService);

  readonly requestId = input.required<string>();
  readonly images = input.required<readonly PartRequestImage[]>();

  protected readonly slots = signal<Readonly<Record<string, Slot>>>({});
  /** Index of the photo open in the viewer. */
  protected readonly viewing = signal<number | null>(null);
  protected readonly viewedUrl = computed(() => {
    const i = this.viewing();
    const image = i === null ? undefined : this.images()[i];
    return image ? this.urlOf(image.id) : null;
  });

  /** Reload only when the actual photos change, not on every refetch of the request. */
  private readonly key = computed(() => `${this.requestId()}|${this.images().map((i) => i.id).join(',')}`);

  private downloads = new Subscription();
  private readonly objectUrls = new Set<string>();

  constructor() {
    effect(() => {
      this.key();
      untracked(() => this.loadAll());
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  protected urlOf(imageId: string): string | null {
    const slot = this.slots()[imageId];
    return slot?.status === 'ready' ? slot.url : null;
  }

  protected failed(imageId: string): boolean {
    return this.slots()[imageId]?.status === 'error';
  }

  protected retry(image: PartRequestImage): void {
    this.downloads.add(this.fetch(image).subscribe((result) => this.settle(result)));
  }

  protected open(index: number): void {
    if (this.urlOf(this.images()[index].id)) this.viewing.set(index);
  }

  protected step(delta: number): void {
    const count = this.images().length;
    const i = this.viewing();
    if (i !== null && count) this.viewing.set((i + delta + count) % count);
  }

  private loadAll(): void {
    this.release();
    const images = this.images();
    this.slots.set(Object.fromEntries(images.map((img) => [img.id, { status: 'loading' } as Slot])));
    this.viewing.set(null);
    this.downloads = from(images)
      .pipe(mergeMap((img) => this.fetch(img), CONCURRENCY))
      .subscribe((result) => this.settle(result));
  }

  private fetch(image: PartRequestImage): Observable<{ id: string; url: string | null }> {
    this.slots.update((s) => ({ ...s, [image.id]: { status: 'loading' } }));
    return this.service.image(this.requestId(), image.id).pipe(
      map((blob) => ({ id: image.id, url: URL.createObjectURL(blob) })),
      catchError(() => of({ id: image.id, url: null })),
    );
  }

  private settle({ id, url }: { id: string; url: string | null }): void {
    if (url) this.objectUrls.add(url);
    this.slots.update((s) => ({ ...s, [id]: url ? { status: 'ready', url } : { status: 'error' } }));
  }

  /** Cancels in-flight downloads and frees every blob this gallery created. */
  private release(): void {
    this.downloads.unsubscribe();
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls.clear();
  }
}
