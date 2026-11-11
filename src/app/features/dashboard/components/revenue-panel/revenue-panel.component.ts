import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AreaChartComponent, ChartPoint } from '../../../../shared/components/charts/area-chart/area-chart.component';
import { DeltaComponent } from '../../../../shared/components/delta/delta.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CountUpDirective } from '../../../../shared/directives/count-up.directive';
import {
  formatDayMonth,
  formatInteger,
  formatMoney,
  formatMoneyCompact,
} from '../../../../shared/utils/format.util';
import { DashboardOverview } from '../../models/dashboard.model';

type View = 'chart' | 'table';

/** The dashboard's hero: total revenue + revenue over time (chart or table view). */
@Component({
  selector: 'app-revenue-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AreaChartComponent, CountUpDirective, DeltaComponent, IconComponent],
  templateUrl: './revenue-panel.component.html',
  styleUrl: './revenue-panel.component.scss',
})
export class RevenuePanelComponent {
  readonly revenue = input.required<DashboardOverview['revenue']>();
  readonly period = input.required<string>();

  protected readonly view = signal<View>('chart');

  protected readonly formatMoney = formatMoney;
  protected readonly formatMoneyCompact = formatMoneyCompact;
  protected readonly formatInteger = formatInteger;
  protected readonly formatDayMonth = formatDayMonth;

  /** Nothing sold in the period — explain instead of drawing a flat line at 0. */
  protected readonly isEmpty = computed(() => {
    const r = this.revenue();
    return !r.total && r.series.every((p) => !p.revenue && !p.orders);
  });

  protected readonly points = computed<ChartPoint[]>(() =>
    this.revenue().series.map((p) => ({ label: formatDayMonth(p.date), value: p.revenue })),
  );

  protected setView(view: View): void {
    this.view.set(view);
  }
}
