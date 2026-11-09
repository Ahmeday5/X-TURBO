import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CountUpDirective } from '../../directives/count-up.directive';
import { formatInteger } from '../../utils/format.util';

export interface StatusTab {
  /** `null` = "all". */
  value: string | null;
  label: string;
  /** CSS colour (token). */
  color: string;
  /** `null` hides the counter. */
  count: number | null;
}

/**
 * Quick-filter tabs ("all" + one per status) with live counts. Generic
 * version of the orders tabs — build `tabs` from a feature's status map.
 *
 *   <app-status-tabs [tabs]="tabs()" [active]="status()" (activeChange)="state.setFilter('status', $event)" />
 */
@Component({
  selector: 'app-status-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountUpDirective],
  template: `
    <div class="stb" role="tablist" [attr.aria-label]="label()">
      @for (t of tabs(); track t.label; let i = $index) {
        <button type="button" role="tab" class="stb__tab" [style.--c]="t.color" [style.--i]="i"
          [attr.aria-selected]="(active() || null) === t.value" (click)="activeChange.emit(t.value)">
          <span class="stb__dot"></span>
          <span>{{ t.label }}</span>
          @if (t.count !== null) {
            <span class="stb__count" [appCountUp]="t.count" [countUpFormat]="format"></span>
          }
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; margin-bottom: 14px; }
      .stb {
        display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 6px;
        scroll-snap-type: x proximity; scrollbar-width: none;
      }
      .stb::-webkit-scrollbar { display: none; }
      .stb__tab {
        --c: var(--txt2);
        position: relative; flex: 0 0 auto; scroll-snap-align: start;
        display: inline-flex; align-items: center; gap: 8px;
        padding: 9px 14px; border-radius: 12px; cursor: pointer;
        border: 1px solid var(--brd); background: var(--bg2); color: var(--txt2);
        font: inherit; font-size: 12.5px; font-weight: 600;
        transition: color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out),
          background var(--dur) var(--ease-out), transform var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
        animation: reveal-up 0.5s var(--ease-out) both; animation-delay: calc(var(--i) * 45ms);
      }
      .stb__tab:hover { color: var(--txt); transform: translateY(-1px); border-color: var(--brd2); }
      .stb__tab:focus-visible { outline: none; box-shadow: var(--focus-ring); }
      .stb__tab[aria-selected='true'] {
        color: var(--c); border-color: color-mix(in srgb, var(--c) 45%, transparent);
        background: color-mix(in srgb, var(--c) 9%, var(--bg2));
        box-shadow: 0 8px 20px -14px var(--c);
      }
      .stb__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); transition: transform var(--dur) var(--ease-out); }
      .stb__tab[aria-selected='true'] .stb__dot { transform: scale(1.35); }
      .stb__count {
        min-width: 26px; padding: 1px 7px; border-radius: 999px; text-align: center;
        font-size: 11px; font-variant-numeric: tabular-nums; background: var(--bg3); color: var(--txt2);
        transition: background var(--dur), color var(--dur);
      }
      .stb__tab[aria-selected='true'] .stb__count { background: var(--c); color: #fff; }
      @media (prefers-reduced-motion: reduce) { .stb__tab { animation: none; } }
    `,
  ],
})
export class StatusTabsComponent {
  readonly tabs = input.required<readonly StatusTab[]>();
  readonly active = input<string | null | undefined>(null);
  readonly label = input('تصفية حسب الحالة');
  readonly activeChange = output<string | null>();

  protected readonly format = formatInteger;
}
