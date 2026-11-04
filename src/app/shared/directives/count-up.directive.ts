import { DestroyRef, Directive, effect, ElementRef, inject, input, NgZone, untracked } from '@angular/core';

const DURATION_MS = 900;

/**
 * Animates the host's text from the previously shown value to the new one.
 *
 *   <span [appCountUp]="revenue" [countUpFormat]="formatMoney"></span>
 *
 * Writes `textContent` directly from rAF outside NgZone (no change detection
 * per frame). Reduced-motion users get the final value immediately. The host
 * must have no other content — the directive owns its text.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective {
  readonly appCountUp = input.required<number>();
  readonly countUpFormat = input<(value: number) => string>((v) => Math.round(v).toString());

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly win = this.el.ownerDocument.defaultView;
  private readonly reduceMotion = this.win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

  private shown = 0;
  private frame = 0;

  constructor() {
    effect(() => {
      const target = this.appCountUp();
      const format = this.countUpFormat();
      untracked(() => this.animateTo(target, format));
    });
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  private animateTo(target: number, format: (value: number) => string): void {
    this.cancel();
    if (this.reduceMotion || !this.win) {
      this.render(target, format);
      return;
    }

    const from = this.shown;
    const start = this.win.performance.now();
    const win = this.win;

    this.zone.runOutsideAngular(() => {
      const tick = (now: number): void => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        this.render(t < 1 ? from + (target - from) * eased : target, format);
        this.frame = t < 1 ? win.requestAnimationFrame(tick) : 0;
      };
      this.frame = win.requestAnimationFrame(tick);
    });
  }

  private render(value: number, format: (value: number) => string): void {
    this.shown = value;
    this.el.textContent = format(value);
  }

  private cancel(): void {
    if (this.frame) this.win?.cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
