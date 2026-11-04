import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  viewChild,
} from '@angular/core';
import { prefersReducedMotion } from '../../../utils/motion.util';

const VIEW_W = 120;
const VIEW_H = 36;
const PAD_Y = 4;

/**
 * Compact trend line for stat tiles: history in the de-emphasis tone, the
 * current (last) period in the accent with an end-dot. Decorative — the
 * tile's value/delta carry the numbers, so the SVG is aria-hidden.
 *
 * Reveals left→right (clip wipe, so the stroke can stay non-scaling) every
 * time `values` changes.
 */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg #svg class="spk" [attr.viewBox]="'0 0 ' + viewW + ' ' + viewH" preserveAspectRatio="none" aria-hidden="true">
      <path class="spk__history" [attr.d]="geometry().history" />
      <path class="spk__current" [attr.d]="geometry().current" />
    </svg>
    <span #dot class="spk__dot" [style.top.%]="geometry().lastYPct"></span>
  `,
  styleUrl: './sparkline.component.scss',
})
export class SparklineComponent {
  readonly values = input.required<readonly number[]>();

  protected readonly viewW = VIEW_W;
  protected readonly viewH = VIEW_H;

  private readonly svg = viewChild.required<ElementRef<SVGElement>>('svg');
  private readonly dot = viewChild.required<ElementRef<HTMLElement>>('dot');

  protected readonly geometry = computed(() => {
    const values = this.values();
    if (values.length < 2) return { history: '', current: '', lastYPct: 50 };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = VIEW_W / (values.length - 1);
    const pts = values.map((v, i) => ({
      x: i * step,
      y: PAD_Y + (1 - (v - min) / span) * (VIEW_H - PAD_Y * 2),
    }));

    const toPath = (list: typeof pts): string =>
      list.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

    return {
      history: toPath(pts.slice(0, -1)),
      current: toPath(pts.slice(-2)),
      lastYPct: (pts[pts.length - 1].y / VIEW_H) * 100,
    };
  });

  constructor() {
    const injector = inject(Injector);
    effect(() => {
      this.geometry(); // replay whenever the data changes
      afterNextRender(() => this.playIntro(), { injector });
    });
  }

  private playIntro(): void {
    if (prefersReducedMotion()) return;
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    this.svg().nativeElement.animate(
      [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
      { duration: 1000, easing },
    );
    this.dot().nativeElement.animate(
      [{ transform: 'scale(0)' }, { transform: 'scale(1)' }],
      { duration: 350, delay: 900, easing, fill: 'backwards' },
    );
  }
}
