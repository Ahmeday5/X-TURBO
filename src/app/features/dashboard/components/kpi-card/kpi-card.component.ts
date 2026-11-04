import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SparklineComponent } from '../../../../shared/components/charts/sparkline/sparkline.component';
import { DeltaComponent } from '../../../../shared/components/delta/delta.component';
import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';
import { CountUpDirective } from '../../../../shared/directives/count-up.directive';
import { KpiValue } from '../../models/dashboard.model';

/** Stat tile: label · value (counts up) · delta vs previous period · sparkline. */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountUpDirective, DeltaComponent, IconComponent, SparklineComponent],
  template: `
    <article class="panel panel--interactive kpi">
      <header class="kpi__head">
        <span class="kpi__label">{{ label() }}</span>
        <span class="kpi__icon"><app-icon [name]="icon()" [size]="16" /></span>
      </header>
      <div class="kpi__value" [appCountUp]="kpi().value" [countUpFormat]="format()"></div>
      <app-delta [pct]="kpi().deltaPct" [upIsGood]="upIsGood()" [period]="period()" />
      <app-sparkline class="kpi__trend" [values]="kpi().trend" />
    </article>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .kpi { display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
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
}
