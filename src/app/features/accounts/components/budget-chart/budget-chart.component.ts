import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatMoney, formatMoneyCompact } from '../../../../shared/utils/format.util';

export interface BudgetChartMonth {
  label: string;
  planned: number;
  /** `null` for months not reached yet. */
  actual: number | null;
}

const TICKS = 4;

/**
 * Plan vs actual per month: a recessive "planned" bar next to a solid
 * "actual" bar, one shared value axis, per-month hover tooltip.
 * Negative values are clamped to the baseline (the grid shows the exact numbers).
 */
@Component({
  selector: 'app-budget-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './budget-chart.component.html',
  styleUrl: './budget-chart.component.scss',
})
export class BudgetChartComponent {
  readonly months = input.required<readonly BudgetChartMonth[]>();
  readonly height = input<number>(220);

  protected readonly active = signal<number | null>(null);
  protected readonly money = formatMoney;

  protected readonly scale = computed(() => {
    const max = Math.max(0, ...this.months().flatMap((m) => [m.planned, m.actual ?? 0]));
    const { step, top } = niceScale(max);
    const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => ({
      pct: ((i * step) / top) * 100,
      label: formatMoneyCompact(i * step),
    })).reverse();
    return { top, ticks };
  });

  protected pct(value: number | null): number {
    if (value === null || value <= 0) return 0;
    return Math.min(100, (value / this.scale().top) * 100);
  }

  protected achievement(m: BudgetChartMonth): string {
    if (m.actual === null) return 'لم يبدأ بعد';
    if (!m.planned) return 'بدون مخطط';
    return `${Math.round((m.actual / m.planned) * 100)}% من المخطط`;
  }
}

function niceScale(max: number): { step: number; top: number } {
  if (max <= 0) return { step: 1, top: TICKS };
  const raw = max / TICKS;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return { step, top: Math.ceil(max / step) * step };
}
