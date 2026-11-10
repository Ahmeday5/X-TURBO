import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { addDaysIso, startOfMonthIso, startOfYearIso, todayIsoDate } from '../../utils/date-iso.util';

export interface DateRange {
  from: string | null;
  to: string | null;
}

interface Preset {
  key: string;
  label: string;
  range: () => DateRange;
}

/** Cairo today minus `days`. */
const daysAgo = (days: number): string => addDaysIso(todayIsoDate(), -days);

const PRESETS: readonly Preset[] = [
  { key: 'today', label: 'اليوم', range: () => ({ from: daysAgo(0), to: daysAgo(0) }) },
  { key: '7d', label: '7 أيام', range: () => ({ from: daysAgo(6), to: null }) },
  { key: '30d', label: '30 يومًا', range: () => ({ from: daysAgo(29), to: null }) },
  { key: 'month', label: 'هذا الشهر', range: () => ({ from: startOfMonthIso(todayIsoDate()), to: null }) },
  { key: 'year', label: 'هذا العام', range: () => ({ from: startOfYearIso(todayIsoDate()), to: null }) },
];

/**
 * From / to date inputs with quick presets. Emits the whole range on every
 * change; empty bounds are `null` (open-ended).
 *
 *   <app-date-range [from]="from()" [to]="to()" (rangeChange)="setRange($event)" />
 */
@Component({
  selector: 'app-date-range',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dr">
      <label class="dr__field">
        <span>من</span>
        <input type="date" class="ui-input" [value]="from() ?? ''" [max]="to() ?? ''"
          (change)="emit($any($event.target).value || null, to())" />
      </label>
      <label class="dr__field">
        <span>إلى</span>
        <input type="date" class="ui-input" [value]="to() ?? ''" [min]="from() ?? ''"
          (change)="emit(from(), $any($event.target).value || null)" />
      </label>
      @if (presets()) {
        <div class="seg dr__presets" role="group" aria-label="فترات سريعة">
          @for (p of presetList; track p.key) {
            <button type="button" class="seg__btn" [attr.aria-pressed]="activePreset() === p.key" (click)="apply(p)">{{ p.label }}</button>
          }
          @if (clearable() && (from() || to())) {
            <button type="button" class="seg__btn" (click)="emit(null, null)">الكل</button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .dr { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
      .dr__field { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--txt3); }
      .dr__field .ui-input { width: 150px; }
      .dr__presets { flex-wrap: wrap; }
      @media (max-width: 575.98px) {
        .dr__field { flex: 1 1 140px; }
        .dr__field .ui-input { width: 100%; }
      }
    `,
  ],
})
export class DateRangeComponent {
  readonly from = input<string | null>(null);
  readonly to = input<string | null>(null);
  readonly presets = input(true);
  /** Offer "all time" (clears both bounds). */
  readonly clearable = input(true);
  readonly rangeChange = output<DateRange>();

  protected readonly presetList = PRESETS;

  protected readonly activePreset = computed(() => {
    const from = this.from();
    const to = this.to();
    return PRESETS.find((p) => {
      const r = p.range();
      return r.from === from && (r.to ?? null) === (to ?? null);
    })?.key;
  });

  protected apply(p: Preset): void {
    const r = p.range();
    this.emit(r.from, r.to);
  }

  protected emit(from: string | null, to: string | null): void {
    this.rangeChange.emit({ from, to });
  }
}
