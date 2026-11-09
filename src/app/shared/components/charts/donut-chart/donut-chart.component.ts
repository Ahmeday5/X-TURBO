import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** CSS colour or token, e.g. `var(--gr)`. */
  color: string;
}

const R = 42;
const CIRC = 2 * Math.PI * R;
/** Gap between segments, in circumference units. */
const GAP = 1.6;

/**
 * Part-to-whole ring with a centre total and a legend that doubles as the
 * hover/focus target (no tooltip needed — every row carries value + share).
 * Segments sweep in on load / data change.
 */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dn" [class.has-active]="active() !== null">
      <div class="dn__ring">
        <svg viewBox="0 0 100 100" role="img" [attr.aria-label]="ariaLabel()">
          <circle class="dn__track" cx="50" cy="50" [attr.r]="r" />
          @for (s of arcs(); track s.key + total(); let i = $index) {
            <circle class="dn__arc" cx="50" cy="50" [attr.r]="r"
              [class.is-active]="active() === s.key"
              [style.stroke]="s.color"
              [style.--len]="s.len"
              [style.--circ]="circ"
              [style.--i]="i"
              [attr.stroke-dasharray]="s.len + ' ' + circ"
              [attr.stroke-dashoffset]="-s.offset"
              (pointerenter)="active.set(s.key)" (pointerleave)="active.set(null)" />
          }
        </svg>
        <div class="dn__center">
          <strong>{{ center().value }}</strong>
          <span>{{ center().label }}</span>
        </div>
      </div>

      <ul class="dn__legend">
        @for (s of arcs(); track s.key; let i = $index) {
          <li class="dn__item" tabindex="0" [style.--i]="i" [class.is-active]="active() === s.key"
            (pointerenter)="active.set(s.key)" (pointerleave)="active.set(null)"
            (focus)="active.set(s.key)" (blur)="active.set(null)">
            <span class="dn__dot" [style.background]="s.color"></span>
            <span class="dn__label">{{ s.label }}</span>
            <span class="dn__value">{{ format()(s.value) }}</span>
            <span class="dn__pct">{{ s.pct }}%</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .dn { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; justify-content: center; }
      .dn__ring { position: relative; width: min(190px, 100%); aspect-ratio: 1; flex-shrink: 0; }
      svg { width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
      .dn__track { fill: none; stroke: var(--bg3); stroke-width: 11; }
      .dn__arc {
        fill: none; stroke-width: 11; stroke-linecap: butt; cursor: pointer;
        transition: stroke-width var(--dur) var(--ease-out), opacity var(--dur) var(--ease-out);
        animation: dn-sweep 1s var(--ease-out) both;
        animation-delay: calc(var(--i) * 90ms + 120ms);
      }
      .has-active .dn__arc { opacity: 0.35; }
      .has-active .dn__arc.is-active { opacity: 1; stroke-width: 14; }
      @keyframes dn-sweep { from { stroke-dasharray: 0 var(--circ); } }

      .dn__center {
        position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; text-align: center; pointer-events: none;
        animation: dn-pop 0.6s var(--ease-out) 0.35s both;
      }
      .dn__center strong { font-size: 19px; font-weight: 700; color: var(--txt); line-height: 1.2; font-variant-numeric: tabular-nums; }
      .dn__center span { font-size: 11px; color: var(--txt3); }
      @keyframes dn-pop { from { opacity: 0; transform: scale(0.85); } }

      .dn__legend { list-style: none; margin: 0; padding: 0; flex: 1 1 200px; min-width: 0; display: grid; gap: 4px; }
      .dn__item {
        display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 10px;
        padding: 7px 10px; border-radius: 10px; font-size: 12px; cursor: default; outline: none;
        transition: background var(--dur-fast), opacity var(--dur-fast);
        animation: dn-in 0.5s var(--ease-out) both; animation-delay: calc(var(--i) * 60ms + 200ms);
      }
      .dn__item.is-active, .dn__item:focus-visible { background: var(--bg3); }
      .has-active .dn__item:not(.is-active) { opacity: 0.55; }
      .dn__dot { width: 9px; height: 9px; border-radius: 3px; }
      .dn__label { color: var(--txt2); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dn__value { color: var(--txt); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .dn__pct { min-width: 44px; text-align: end; color: var(--txt3); font-size: 11px; font-variant-numeric: tabular-nums; }
      @keyframes dn-in { from { opacity: 0; transform: translateY(6px); } }

      @media (prefers-reduced-motion: reduce) { .dn__arc, .dn__center, .dn__item { animation: none; } }
    `,
  ],
})
export class DonutChartComponent {
  readonly segments = input.required<readonly DonutSegment[]>();
  readonly centerLabel = input('الإجمالي');
  readonly format = input<(value: number) => string>((v) => v.toLocaleString());
  /** Formats the centre total; defaults to `format`. */
  readonly formatTotal = input<((value: number) => string) | null>(null);

  protected readonly r = R;
  protected readonly circ = CIRC;
  protected readonly active = signal<string | null>(null);

  protected readonly total = computed(() => this.segments().reduce((a, s) => a + s.value, 0));

  protected readonly arcs = computed(() => {
    const total = this.total() || 1;
    const visible = this.segments().filter((s) => s.value > 0).length;
    let offset = 0;
    return this.segments().map((s) => {
      const share = s.value / total;
      const full = share * CIRC;
      const len = Math.max(0, full - (visible > 1 && s.value > 0 ? GAP : 0));
      const arc = { ...s, len, offset, pct: Math.round(share * 1000) / 10 };
      offset += full;
      return arc;
    });
  });

  protected readonly center = computed(() => {
    const key = this.active();
    const seg = key ? this.arcs().find((s) => s.key === key) : null;
    const fmt = this.formatTotal() ?? this.format();
    return seg ? { value: `${seg.pct}%`, label: seg.label } : { value: fmt(this.total()), label: this.centerLabel() };
  });

  protected readonly ariaLabel = computed(() =>
    this.arcs().map((s) => `${s.label}: ${this.format()(s.value)} (${s.pct}%)`).join('، '),
  );
}
