import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SparklineComponent } from '../charts/sparkline/sparkline.component';
import { DeltaComponent } from '../delta/delta.component';
import { IconComponent, IconName } from '../icon/icon.component';
import { CountUpDirective } from '../../directives/count-up.directive';
import { KpiValue } from '../../models/kpi.model';

/** What a zero value means for this KPI — said in words instead of a flat chart. */
export interface KpiEmptyNote {
  text: string;
  /** `good` (e.g. nothing below reorder level) or `neutral` (e.g. no orders yet). */
  tone: 'good' | 'neutral';
}

/**
 * Stat tile: label · value (counts up) · delta vs previous period · sparkline.
 * With `link` the whole tile opens the related screen; with `emptyNote` a zero
 * value shows a short explanation instead of a 0% delta and an empty chart.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountUpDirective, DeltaComponent, IconComponent, NgTemplateOutlet, RouterLink, SparklineComponent],
  template: `
    <ng-template #body>
      <header class="kpi__head">
        <span class="kpi__label">{{ label() }}</span>
        <span class="kpi__icon"><app-icon [name]="icon()" [size]="16" /></span>
      </header>
      <div class="kpi__value" [appCountUp]="kpi().value" [countUpFormat]="format()"></div>
      @if (empty(); as note) {
        <p class="kpi__note" [class.is-good]="note.tone === 'good'">
          <app-icon [name]="note.tone === 'good' ? 'check' : 'alert'" [size]="13" /> {{ note.text }}
        </p>
      } @else {
        <app-delta [pct]="kpi().deltaPct" [upIsGood]="upIsGood()" [period]="period()" />
        <app-sparkline class="kpi__trend" [values]="kpi().trend" />
      }
      @if (link()) {<span class="kpi__go" aria-hidden="true"><app-icon name="arrow-right" [size]="13" /></span>}
    </ng-template>

    @if (link(); as to) {
      <a class="panel panel--interactive kpi kpi--link" [routerLink]="to" [queryParams]="linkParams()"
        [attr.aria-label]="label() + ' — عرض التفاصيل'">
        <ng-container *ngTemplateOutlet="body" />
      </a>
    } @else {
      <article class="panel panel--interactive kpi"><ng-container *ngTemplateOutlet="body" /></article>
    }
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .kpi { position: relative; display: flex; flex-direction: column; gap: 8px; height: 100%; overflow: hidden; }
      .kpi--link { color: inherit; text-decoration: none; cursor: pointer; }
      .kpi--link:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
      .kpi__head { display: flex; align-items: center; justify-content: space-between; }
      .kpi__label { font-size: 12px; font-weight: 600; color: var(--txt2); }
      .kpi__icon {
        width: 32px; height: 32px; display: grid; place-items: center;
        border-radius: 10px; background: var(--primary-soft); color: var(--primary);
        transition: transform var(--dur) var(--ease-out);
      }
      .kpi:hover .kpi__icon { transform: rotate(-8deg) scale(1.08); }
      .kpi__value { font-size: 24px; font-weight: 700; color: var(--txt); line-height: 1.15; }
      .kpi__trend { margin-top: 6px; }
      .kpi__note {
        display: inline-flex; align-items: center; gap: 5px; align-self: flex-start; margin: 2px 0 0;
        padding: 4px 10px; border-radius: 999px; font-size: 11.5px; color: var(--txt2); background: var(--bg3);
      }
      .kpi__note.is-good { color: var(--gr); background: color-mix(in srgb, var(--gr) 12%, transparent); }
      .kpi__go {
        position: absolute; inset-block-end: 12px; inset-inline-end: 12px; color: var(--txt3);
        opacity: 0; transform: translateX(calc(var(--dir, -1) * -4px)); transition: opacity var(--dur), transform var(--dur);
      }
      .kpi--link:hover .kpi__go, .kpi--link:focus-visible .kpi__go { opacity: 1; transform: none; color: var(--primary); }
    `,
  ],
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly kpi = input.required<KpiValue>();
  readonly format = input.required<(value: number) => string>();
  readonly upIsGood = input<boolean>(true);
  readonly period = input<string>('');
  /** Screen the tile opens (whole tile is a link). */
  readonly link = input<string | null>(null);
  readonly linkParams = input<Record<string, string> | null>(null);
  /** Shown instead of delta + sparkline when the value is 0. */
  readonly emptyNote = input<KpiEmptyNote | null>(null);

  protected readonly empty = computed(() => (this.kpi().value ? null : this.emptyNote()));
}
