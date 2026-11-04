import { DestroyRef, Directive, ElementRef, inject, NgZone, output } from '@angular/core';

/**
 * Emits when a pointer press lands outside the host — for closing menus and
 * popovers. Listens outside NgZone and only re-enters it to emit.
 *
 *   <div (appClickOutside)="close()">…</div>
 */
@Directive({
  selector: '[appClickOutside]',
  standalone: true,
})
export class ClickOutsideDirective {
  readonly appClickOutside = output<void>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const zone = inject(NgZone);
    const doc = host.ownerDocument;

    const onPointerDown = (event: PointerEvent): void => {
      if (!host.contains(event.target as Node)) zone.run(() => this.appClickOutside.emit());
    };

    zone.runOutsideAngular(() => doc.addEventListener('pointerdown', onPointerDown, true));
    inject(DestroyRef).onDestroy(() => doc.removeEventListener('pointerdown', onPointerDown, true));
  }
}
