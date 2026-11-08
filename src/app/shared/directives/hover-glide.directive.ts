import { DestroyRef, Directive, ElementRef, inject, input, NgZone } from '@angular/core';
import { prefersReducedMotion } from '../utils/motion.util';

/**
 * A highlight that glides between items as the pointer moves over a list,
 * instead of each item flashing its own hover background.
 *
 *   <div appHoverGlide="[data-nav]">…items…</div>
 *
 * The host must be `position: relative`. Colour/radius come from CSS vars
 * `--glide-bg` / the hovered item's own border-radius. Runs outside NgZone;
 * disabled on touch-only devices.
 */
@Directive({
  selector: '[appHoverGlide]',
  standalone: true,
})
export class HoverGlideDirective {
  /** Selector for the items the highlight snaps to. */
  readonly appHoverGlide = input('[data-nav]');

  constructor() {
    const host: HTMLElement = inject(ElementRef).nativeElement;
    const zone = inject(NgZone);
    if (typeof window === 'undefined' || !window.matchMedia?.('(hover: hover)').matches) return;

    const reduced = prefersReducedMotion();
    const glide = document.createElement('span');
    glide.setAttribute('aria-hidden', 'true');
    Object.assign(glide.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      zIndex: '0',
      pointerEvents: 'none',
      opacity: '0',
      background: 'var(--glide-bg, var(--bg3))',
      willChange: 'transform, width, height',
    });
    const motion = reduced
      ? 'opacity .15s'
      : 'transform .32s cubic-bezier(.22,1,.36,1), width .32s cubic-bezier(.22,1,.36,1), height .32s cubic-bezier(.22,1,.36,1), opacity .2s';
    host.prepend(glide);

    let current: HTMLElement | null = null;

    const place = (el: HTMLElement, animate: boolean): void => {
      const h = host.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      glide.style.transition = animate ? motion : 'opacity .2s';
      glide.style.transform = `translate3d(${r.left - h.left + host.scrollLeft}px, ${r.top - h.top + host.scrollTop}px, 0)`;
      glide.style.width = `${r.width}px`;
      glide.style.height = `${r.height}px`;
      glide.style.borderRadius = getComputedStyle(el).borderRadius;
      glide.style.opacity = '1';
    };

    const onOver = (event: PointerEvent): void => {
      const el = (event.target as Element).closest<HTMLElement>(this.appHoverGlide());
      if (!el || !host.contains(el) || el === current) return;
      // First entry jumps into place; moves between items glide.
      place(el, current !== null);
      current = el;
    };

    const onLeave = (): void => {
      glide.style.opacity = '0';
      current = null;
    };

    // Re-measure after layout animations (e.g. a group expanding).
    const onTransitionEnd = (event: TransitionEvent): void => {
      if (current && event.target !== glide && current.isConnected) place(current, true);
      else if (current && !current.isConnected) onLeave();
    };

    zone.runOutsideAngular(() => {
      host.addEventListener('pointerover', onOver);
      host.addEventListener('pointerleave', onLeave);
      host.addEventListener('transitionend', onTransitionEnd);
    });

    inject(DestroyRef).onDestroy(() => {
      host.removeEventListener('pointerover', onOver);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('transitionend', onTransitionEnd);
      glide.remove();
    });
  }
}
