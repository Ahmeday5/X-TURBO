import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { prefersReducedMotion } from '../../../utils/motion.util';

export interface ChartPoint {
  /** Axis / tooltip label, already formatted (e.g. "4 Nov"). */
  label: string;
  value: number;
}

const MARGIN = { top: 14, bottom: 30, axis: 78, edge: 14 };
const Y_TICKS = 4;
const MAX_X_LABELS = 7;

/**
 * Single-series area chart: 2px line, ~10% wash, hairline grid, a crosshair
 * that snaps to the nearest point and a tooltip (value first, label second).
 * Keyboard: focus the chart, then ←/→ to step through points.
 *
 * Direction-aware: under `dir="rtl"` time flows right→left and the value
 * axis sits on the right, matching the reading direction.
 *
 * Draws in real pixels (width measured with ResizeObserver) so text stays
 * crisp and the stroke stays exactly 2px at any size. The line replays its
 * draw-in when `points` changes — not on resize.
 */
@Component({
  selector: 'app-area-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './area-chart.component.html',
  styleUrl: './area-chart.component.scss',
})
export class AreaChartComponent {
  readonly points = input.required<readonly ChartPoint[]>();
  readonly seriesName = input.required<string>();
  readonly formatValue = input<(value: number) => string>((v) => v.toLocaleString());
  readonly formatTick = input<((value: number) => string) | null>(null);
  readonly height = input<number>(260);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly rtl = inject(DOCUMENT).documentElement.dir === 'rtl';
  private readonly lineRef = viewChild<ElementRef<SVGPathElement>>('line');
  private readonly areaRef = viewChild<ElementRef<SVGPathElement>>('area');
  private readonly width = signal(0);
  protected readonly active = signal<number | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    const injector = inject(Injector);

    afterNextRender(() => {
      const ro = new ResizeObserver(([entry]) => this.width.set(Math.floor(entry.contentRect.width)));
      ro.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => ro.disconnect());
    });

    // Replay the draw-in when the dataset changes (or the paths first appear) —
    // never on resize, which only changes `width`.
    effect(() => {
      this.points();
      const line = this.lineRef();
      const area = this.areaRef();
      if (!line || !area) return;
      untracked(() => afterNextRender(() => this.playIntro(line.nativeElement, area.nativeElement), { injector }));
    });
  }

  private playIntro(line: SVGPathElement, area: SVGPathElement): void {
    if (prefersReducedMotion()) return;
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1100, easing });
    area.animate([{ opacity: 0 }, { opacity: 0.1 }], { duration: 800, delay: 350, easing, fill: 'backwards' });
  }

  protected readonly geo = computed(() => {
    const pts = this.points();
    const w = this.width();
    const h = this.height();
    const innerW = Math.max(0, w - MARGIN.axis - MARGIN.edge);
    const innerH = Math.max(0, h - MARGIN.top - MARGIN.bottom);

    // Plot area in physical px; the value axis sits on the reading-start side.
    const left = this.rtl ? MARGIN.edge : MARGIN.axis;
    const right = left + innerW;

    const { step, top } = niceScale(Math.max(0, ...pts.map((p) => p.value)), Y_TICKS);
    const x = (i: number): number => {
      const t = pts.length <= 1 ? 0.5 : i / (pts.length - 1);
      return this.rtl ? right - t * innerW : left + t * innerW;
    };
    const y = (v: number): number => MARGIN.top + innerH * (1 - v / top);

    const coords = pts.map((p, i) => ({ x: x(i), y: y(p.value) }));
    const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const baseline = MARGIN.top + innerH;
    const area = coords.length
      ? `${line} L${coords[coords.length - 1].x.toFixed(1)} ${baseline} L${coords[0].x.toFixed(1)} ${baseline} Z`
      : '';

    const tickFormat = this.formatTick() ?? this.formatValue();
    const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => {
      const value = i * step;
      return { y: y(value), label: tickFormat(value) };
    });
    const axisLabel = this.rtl
      ? { x: right + 10, anchor: 'start' }
      : { x: left - 10, anchor: 'end' };

    const stride = Math.max(1, Math.ceil(pts.length / MAX_X_LABELS));
    const xTicks = pts
      .map((p, i) => ({ x: x(i), label: p.label, i }))
      .filter((t) => t.i % stride === 0 || t.i === pts.length - 1)
      // Drop a stride label that would collide with the always-shown last one.
      .filter((t, idx, arr) => t.i === pts.length - 1 || arr[arr.length - 1].i - t.i >= stride * 0.6);

    return { w, h, line, area, coords, yTicks, xTicks, baseline, left, right, axisLabel };
  });

  protected readonly tooltip = computed(() => {
    const i = this.active();
    const g = this.geo();
    const p = i === null ? null : this.points()[i];
    if (i === null || !p || !g.coords[i]) return null;
    const c = g.coords[i];
    return {
      x: c.x,
      y: c.y,
      value: this.formatValue()(p.value),
      label: p.label,
      // Flip to the other side of the crosshair near the right edge.
      alignEnd: c.x > g.w * 0.66,
    };
  });

  protected readonly ariaLabel = computed(() => {
    const pts = this.points();
    if (!pts.length) return `${this.seriesName()}: لا توجد بيانات`;
    const fmt = this.formatValue();
    return `${this.seriesName()} من ${pts[0].label} إلى ${pts[pts.length - 1].label}. ` +
      `آخر قيمة ${fmt(pts[pts.length - 1].value)}. استخدم الأسهم لاستعراض القيم.`;
  });

  protected onPointerMove(event: PointerEvent): void {
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    this.active.set(this.nearestIndex(event.clientX - rect.left));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.points().length - 1;
    if (last < 0) return;
    const current = this.active() ?? last;
    // Arrow keys move visually; in RTL "left" is later in time.
    const forward = this.rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = this.rtl ? 'ArrowRight' : 'ArrowLeft';
    const next =
      event.key === back ? Math.max(0, current - 1)
      : event.key === forward ? Math.min(last, current + 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    this.active.set(next);
  }

  protected onFocus(): void {
    if (this.active() === null) this.active.set(this.points().length - 1);
  }

  protected clear(): void {
    this.active.set(null);
  }

  private nearestIndex(px: number): number | null {
    const coords = this.geo().coords;
    if (!coords.length) return null;
    let best = 0;
    for (let i = 1; i < coords.length; i++) {
      if (Math.abs(coords[i].x - px) < Math.abs(coords[best].x - px)) best = i;
    }
    return best;
  }
}

/** Rounds the axis up to a 1/2/2.5/5 × 10ⁿ step so ticks read cleanly. */
function niceScale(max: number, ticks: number): { step: number; top: number } {
  if (max <= 0) return { step: 1, top: ticks };
  const raw = max / ticks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  return { step, top: Math.ceil(max / step) * step };
}
