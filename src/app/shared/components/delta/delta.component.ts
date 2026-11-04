import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatDelta } from '../../utils/format.util';
import { IconComponent } from '../icon/icon.component';

/**
 * Signed change vs a previous period. Colour encodes direction × whether
 * "up" is good for this metric; the arrow + sign carry it without colour.
 */
@Component({
  selector: 'app-delta',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <span class="delta" [class]="'delta delta--' + tone()">
      @if (pct() !== 0) {
        <app-icon [name]="pct() > 0 ? 'trend-up' : 'trend-down'" [size]="13" />
      }
      <span class="ltr">{{ text() }}</span>
    </span>
    @if (period()) {
      <span class="delta-period">{{ period() }}</span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .delta {
        display: inline-flex; align-items: center; gap: 3px;
        padding: 2px 7px; border-radius: 999px;
        font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
      }
      .delta--good    { background: var(--gr-l); color: var(--gr); }
      .delta--bad     { background: var(--re-l); color: var(--re); }
      .delta--neutral { background: var(--bg3);  color: var(--txt2); }
      .delta-period { font-size: 11px; color: var(--txt3); }
    `,
  ],
})
export class DeltaComponent {
  readonly pct = input.required<number>();
  /** False for metrics where growth is bad (e.g. low-stock count). */
  readonly upIsGood = input<boolean>(true);
  readonly period = input<string>('');

  protected readonly text = computed(() => formatDelta(this.pct()));
  protected readonly tone = computed(() => {
    const pct = this.pct();
    if (pct === 0) return 'neutral';
    return pct > 0 === this.upIsGood() ? 'good' : 'bad';
  });
}
