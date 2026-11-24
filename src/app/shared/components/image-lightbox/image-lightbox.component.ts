import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { ImageLightboxService } from './image-lightbox.service';

/**
 * Host of the app-wide image preview — mount once (main layout). Closes on
 * Escape, the ✕ button or a click outside the image. Escape is caught in the
 * capture phase so it closes only the preview, not the drawer / modal under it.
 */
@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (lightbox.current(); as img) {
      <div class="lb" role="dialog" aria-modal="true" [attr.aria-label]="img.alt" (click)="lightbox.close()"
        (wheel)="$event.preventDefault()">
        <button #closeBtn type="button" class="lb__close" aria-label="إغلاق المعاينة" title="إغلاق (Esc)"
          (click)="lightbox.close()">
          <app-icon name="x" [size]="20" />
        </button>

        <figure class="lb__figure" (click)="$event.stopPropagation()">
          @if (failed() === img.src) {
            <div class="lb__error" role="alert">
              <app-icon name="image" [size]="34" />
              <p>تعذّر تحميل الصورة</p>
            </div>
          } @else {
            <img class="lb__img" [class.is-ready]="loaded() === img.src" [src]="img.src" [alt]="img.alt"
              decoding="async" (load)="loaded.set(img.src)" (error)="failed.set(img.src)" />
            @if (loaded() !== img.src) {<span class="lb__spinner" aria-hidden="true"></span>}
          }
          @if (img.caption) {<figcaption class="lb__caption">{{ img.caption }}</figcaption>}
        </figure>
      </div>
    }
  `,
  styles: [
    `
      .lb {
        position: fixed; inset: 0; z-index: 2000;
        display: grid; place-items: center; padding: 56px 16px 24px;
        background: rgba(10, 12, 16, 0.86); backdrop-filter: blur(3px);
        animation: lb-fade 0.18s ease-out; cursor: zoom-out;
      }
      .lb__close {
        position: absolute; top: 12px; inset-inline-end: 12px;
        display: grid; place-items: center; width: 40px; height: 40px;
        border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.12); color: #fff; cursor: pointer;
        transition: background 0.15s;
      }
      .lb__close:hover { background: rgba(255, 255, 255, 0.24); }
      .lb__close:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      .lb__figure {
        position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px;
        margin: 0; max-width: min(1100px, 100%); cursor: default;
      }
      .lb__img {
        display: block; max-width: 100%; max-height: calc(100vh - 140px); object-fit: contain;
        border-radius: 12px; background: #fff; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
        opacity: 0; transform: scale(0.97); transition: opacity 0.2s, transform 0.2s;
      }
      .lb__img.is-ready { opacity: 1; transform: none; }
      .lb__spinner {
        position: absolute; top: 50%; left: 50%; width: 34px; height: 34px; margin: -17px 0 0 -17px;
        border: 3px solid rgba(255, 255, 255, 0.25); border-top-color: #fff; border-radius: 50%;
        animation: lb-spin 0.7s linear infinite;
      }
      .lb__caption { color: #f1f1f1; font-size: 13px; font-weight: 600; text-align: center; }
      .lb__error {
        display: flex; flex-direction: column; align-items: center; gap: 8px;
        padding: 40px 56px; border-radius: 12px; background: rgba(255, 255, 255, 0.08); color: #ddd;
      }
      .lb__error p { margin: 0; font-size: 13px; }
      @keyframes lb-fade { from { opacity: 0; } }
      @keyframes lb-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .lb, .lb__img { animation: none; transition: none; }
      }
    `,
  ],
})
export class ImageLightboxComponent {
  protected readonly lightbox = inject(ImageLightboxService);

  /** `src` that finished loading / failed — keyed by URL so a new image starts fresh. */
  protected readonly loaded = signal<string | null>(null);
  protected readonly failed = signal<string | null>(null);

  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  constructor() {
    // Focus the close button when the preview opens (keyboard users can Enter / Esc right away).
    const injector = inject(Injector);
    effect(() => {
      if (!this.lightbox.current()) return;
      afterNextRender(() => this.closeBtn()?.nativeElement.focus({ preventScroll: true }), { injector });
    });

    const onKeydown = (event: KeyboardEvent) => {
      if (!this.lightbox.current()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.lightbox.close();
      } else if (event.key === 'Tab') {
        // Only one focusable element: keep focus inside the dialog.
        event.preventDefault();
        this.closeBtn()?.nativeElement.focus();
      }
    };
    window.addEventListener('keydown', onKeydown, true);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('keydown', onKeydown, true));
  }
}
