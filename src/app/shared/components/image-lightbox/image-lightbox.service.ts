import { Injectable, signal } from '@angular/core';

/** What the lightbox shows. */
export interface LightboxImage {
  /** Absolute, ready-to-use URL. */
  src: string;
  /** Accessible name of the image (also the dialog's label). */
  alt: string;
  /** Optional line under the image, e.g. "IT-0012 · فلتر زيت". */
  caption?: string;
}

/**
 * App-wide image preview. One `<app-image-lightbox />` host is mounted in the
 * main layout; anything (a table cell, a drawer, a card) calls `open()`.
 * Rendering at the root keeps the overlay out of transformed / clipped
 * ancestors (drawers, scroll containers) that would break `position: fixed`.
 */
@Injectable({ providedIn: 'root' })
export class ImageLightboxService {
  private readonly _current = signal<LightboxImage | null>(null);
  readonly current = this._current.asReadonly();

  /** Element focused before opening — focus goes back to it on close. */
  private returnFocus: HTMLElement | null = null;

  open(image: LightboxImage): void {
    if (!image.src) return;
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this._current.set(image);
  }

  close(): void {
    if (!this._current()) return;
    this._current.set(null);
    const target = this.returnFocus;
    this.returnFocus = null;
    // After the overlay leaves the DOM.
    queueMicrotask(() => target?.focus({ preventScroll: true }));
  }
}
