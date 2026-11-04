import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarListRow {
  key: string;
  label: string;
  /** Secondary line under the label (e.g. category, order count). */
  sub?: string;
  value: number;
  /** Formatted value printed at the bar's end. */
  display: string;
}

/**
 * Ranked horizontal bars — one hue (magnitude, not identity), every row
 * labelled with its value, so no tooltip is needed. Bars grow from a shared
 * baseline: square at the start, 4px round at the data end.
 */
@Component({
  selector: 'app-bar-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="bl">
      @for (row of rows(); track row.key; let i = $index) {
        <li class="bl__row" [style.--i]="i">
          <div class="bl__text">
            <div class="bl__labels">
              <span class="bl__label">{{ row.label }}</span>
              @if (row.sub) {
                <span class="bl__sub">{{ row.sub }}</span>
              }
            </div>
            <span class="bl__value">{{ row.display }}</span>
          </div>
          <div class="bl__track">
            <span class="bl__bar" [style.width.%]="row.pct"></span>
          </div>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      :host { display: block; }
      .bl { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
      .bl__text { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 7px; }
      .bl__labels { min-width: 0; display: flex; flex-direction: column; }
      .bl__label { font-size: 12.5px; font-weight: 600; color: var(--txt); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bl__sub { font-size: 11px; color: var(--txt3); }
      .bl__value { font-size: 12.5px; font-weight: 700; color: var(--txt); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .bl__track,
      .bl__bar { border-start-end-radius: 4px; border-end-end-radius: 4px; }
      .bl__track { height: 8px; background: var(--bg3); overflow: hidden; }
      .bl__bar {
        display: block; height: 100%;
        background: var(--primary);
        transform-origin: var(--start) center;
        animation: bl-grow 0.9s var(--ease-out) both;
        animation-delay: calc(var(--i, 0) * 80ms + 150ms);
      }
      @keyframes bl-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @media (prefers-reduced-motion: reduce) { .bl__bar { animation: none; } }
    `,
  ],
})
export class BarListComponent {
  readonly items = input.required<readonly BarListRow[]>();

  protected readonly rows = computed(() => {
    const items = this.items();
    const max = Math.max(1, ...items.map((r) => r.value));
    return items.map((r) => ({ ...r, pct: (r.value / max) * 100 }));
  });
}
