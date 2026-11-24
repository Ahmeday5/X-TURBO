import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { ImageLightboxService } from '../image-lightbox/image-lightbox.service';

/**
 * A product's photo as a small rounded square (`object-fit: cover`, lazy), or
 * a grey box icon when there is no photo (`null`) or it fails to load.
 * `zoomable` turns it into a button that opens the app-wide lightbox — being a
 * real `<button>`, a click on it never triggers the row's own click.
 *
 *   <app-product-thumb [src]="item.imageUrl" [alt]="item.name" />                  ← 40×40
 *   <app-product-thumb [src]="l.imageUrl" [alt]="l.name" [size]="48" zoomable />
 *
 * Never append a cache-buster to `src`: every new upload gets a new URL.
 */
@Component({
  selector: 'app-product-thumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (url(); as photo) {
      @if (zoomable()) {
        <button type="button" class="pt pt--zoom" [style.width.px]="size()" [style.height.px]="size()"
          [attr.aria-label]="'تكبير صورة ' + alt()" title="تكبير الصورة" (click)="zoom($event, photo)">
          <img class="pt__img" [src]="photo" [alt]="alt()" loading="lazy" decoding="async" (error)="broken.set(photo)" />
        </button>
      } @else {
        <img class="pt pt__img" [src]="photo" [alt]="alt()" loading="lazy" decoding="async"
          [style.width.px]="size()" [style.height.px]="size()" (error)="broken.set(photo)" />
      }
    } @else {
      <span class="pt pt--empty" [style.width.px]="size()" [style.height.px]="size()" role="img"
        [attr.aria-label]="'بدون صورة — ' + alt()">
        <app-icon name="box" [size]="iconSize()" />
      </span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; flex-shrink: 0; vertical-align: middle; line-height: 0; }
      .pt { flex-shrink: 0; overflow: hidden; border-radius: var(--pt-radius, 10px); }
      .pt__img { display: block; width: 100%; height: 100%; object-fit: cover; background: var(--bg3); }
      img.pt { border: 1px solid var(--brd); }
      .pt--zoom {
        position: relative; padding: 0; border: 1px solid var(--brd); background: var(--bg3); cursor: zoom-in;
        transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
      }
      .pt--zoom:hover { border-color: rgba(var(--primary-rgb), 0.45); box-shadow: 0 0 0 3px var(--primary-soft); }
      .pt--zoom:focus-visible { outline: none; box-shadow: var(--focus-ring); }
      .pt--empty { display: grid; place-items: center; background: var(--bg3); color: var(--txt3); }
    `,
  ],
})
export class ProductThumbComponent {
  private readonly lightbox = inject(ImageLightboxService);

  /** Absolute photo URL; `null` / empty = no photo → placeholder. */
  readonly src = input<string | null | undefined>(null);
  /** Product name — the image's accessible name. */
  readonly alt = input.required<string>();
  /** Square size in px. */
  readonly size = input(40);
  /** Click opens a large preview. */
  readonly zoomable = input(false, { transform: (v: boolean | '') => v !== false });
  /** Line under the large preview (defaults to `alt`). */
  readonly caption = input<string | undefined>(undefined);

  /** URL that failed to load → placeholder. A new URL is tried again by itself. */
  protected readonly broken = signal<string | null>(null);
  protected readonly url = computed(() => {
    const src = this.src();
    return src && src !== this.broken() ? src : null;
  });
  protected readonly iconSize = computed(() => Math.max(14, Math.round(this.size() * 0.45)));

  protected zoom(event: Event, src: string): void {
    event.stopPropagation();
    this.lightbox.open({ src, alt: this.alt(), caption: this.caption() ?? this.alt() });
  }
}
