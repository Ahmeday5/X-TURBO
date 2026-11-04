import { DestroyRef, Directive, ElementRef, inject, NgZone, OnInit } from '@angular/core';

/**
 * Publishes the pointer position over the host as CSS custom properties so
 * pure-CSS layers can react to it (parallax, spotlights) without Angular
 * change detection:
 *
 *   --px / --py  → normalised position, -1 … 1 (0 = centre)
 *   --mx / --my  → position in px relative to the host's top-left
 *
 * Writes are batched to one per animation frame and run outside NgZone.
 * Skipped entirely for touch-only devices and reduced-motion users.
 */
@Directive({
  selector: '[appPointerParallax]',
  standalone: true,
})
export class PointerParallaxDirective implements OnInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private frame = 0;
  private lastEvent: PointerEvent | null = null;

  ngOnInit(): void {
    const win = this.host.nativeElement.ownerDocument.defaultView;
    if (!win?.matchMedia) return;
    if (!win.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const el = this.host.nativeElement;
    const onMove = (e: PointerEvent): void => {
      this.lastEvent = e;
      if (!this.frame) this.frame = win.requestAnimationFrame(() => this.flush());
    };
    const onLeave = (): void => {
      el.style.setProperty('--px', '0');
      el.style.setProperty('--py', '0');
    };

    this.zone.runOutsideAngular(() => {
      el.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', onLeave, { passive: true });
    });

    this.destroyRef.onDestroy(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (this.frame) win.cancelAnimationFrame(this.frame);
    });
  }

  private flush(): void {
    this.frame = 0;
    const e = this.lastEvent;
    if (!e) return;

    const el = this.host.nativeElement;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--mx', `${x.toFixed(1)}px`);
    el.style.setProperty('--my', `${y.toFixed(1)}px`);
    el.style.setProperty('--px', ((x / rect.width) * 2 - 1).toFixed(3));
    el.style.setProperty('--py', ((y / rect.height) * 2 - 1).toFixed(3));
  }
}
