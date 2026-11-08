import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/** Matches the Bootstrap `md` breakpoint used across the layout. */
const MOBILE_QUERY = '(max-width: 767.98px)';

/** Reactive viewport breakpoints for layout decisions that CSS alone can't make. */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  readonly isMobile = signal(false);

  constructor() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_QUERY);
    this.isMobile.set(mq.matches);
    const onChange = (e: MediaQueryListEvent) => this.isMobile.set(e.matches);
    mq.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
  }
}
