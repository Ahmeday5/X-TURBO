import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CountUpDirective } from '../../directives/count-up.directive';
import { IconComponent, IconName } from '../icon/icon.component';

export interface SummaryTile {
  label: string;
  icon: IconName;
  /** `null` while loading → skeleton. */
  value: number | null;
  format: (value: number) => string;
  /** CSS colour (token) for the icon and glow; defaults to the brand colour. */
  tone?: string;
  /** Small line under the value (e.g. "12 مستند"). */
  hint?: string;
}

/**
 * Row of summary tiles above a list (counts / totals for the current filters).
 *
 *   <app-summary-tiles [tiles]="tiles()" [refreshing]="stats.loading()" />
 */
@Component({
  selector: 'app-summary-tiles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountUpDirective, IconComponent],
  template: `
    <div class="st" [class.is-refreshing]="refreshing()" [style.--cols]="columns() || tiles().length">
      @for (t of tiles(); track t.label; let i = $index) {
        <article class="panel panel--interactive st__tile reveal" [style.--i]="i" [style.--tone]="t.tone ?? 'var(--primary)'">
          <span class="st__icon"><app-icon [name]="t.icon" [size]="18" /></span>
          <div class="st__text">
            <span class="st__label">{{ t.label }}</span>
            @if (t.value !== null) {
              <strong [appCountUp]="t.value" [countUpFormat]="t.format"></strong>
            } @else {
              <span class="skeleton" style="width: 90px; height: 22px"></span>
            }
            @if (t.hint) {<small>{{ t.hint }}</small>}
          </div>
        </article>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; margin-bottom: 16px; }
      .st {
        display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); gap: 14px;
        transition: opacity var(--dur) var(--ease-out);
      }
      .st.is-refreshing { opacity: 0.6; }
      @media (max-width: 1199.98px) { .st { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 420px) { .st { gap: 10px; } }

      .st__tile { display: flex; align-items: center; gap: 12px; padding: 16px; overflow: hidden; }
      .st__tile::after {
        content: ''; position: absolute; inset-inline-end: -30px; top: -30px; width: 90px; height: 90px;
        border-radius: 50%; background: var(--tone); opacity: 0.07;
        transition: transform 0.5s var(--ease-out), opacity var(--dur);
      }
      .st__tile:hover::after { transform: scale(1.6); opacity: 0.12; }
      .st__icon {
        flex-shrink: 0; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px;
        color: var(--tone); background: color-mix(in srgb, var(--tone) 12%, transparent);
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .st__tile:hover .st__icon { transform: rotate(-8deg) scale(1.08); }
      .st__text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .st__label { font-size: 11.5px; font-weight: 600; color: var(--txt3); }
      .st__text strong {
        font-size: 19px; font-weight: 700; color: var(--txt); white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums;
      }
      .st__text small { font-size: 11px; color: var(--txt3); }

      @media (max-width: 575.98px) {
        .st__tile { padding: 12px; gap: 10px; }
        .st__icon { width: 36px; height: 36px; border-radius: 11px; }
        .st__text strong { font-size: 15px; }
      }
    `,
  ],
})
export class SummaryTilesComponent {
  readonly tiles = input.required<readonly SummaryTile[]>();
  readonly refreshing = input(false);
  /** Desktop column count (defaults to the number of tiles). */
  readonly columns = input<number | null>(null);
}
