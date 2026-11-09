import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * List-toolbar filter: a select whose first option ("all") clears the filter.
 * Drop it into `<app-list-toolbar>` with the `filters` attribute.
 *
 *   <app-filter-select filters label="الحالة" allLabel="كل الحالات" [options]="statusOptions"
 *     [value]="state.query().filters['status']" (valueChange)="state.setFilter('status', $event)" />
 */
@Component({
  selector: 'app-filter-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <select class="ui-input fs" [class.is-active]="!!value()" [attr.aria-label]="label()"
      (change)="valueChange.emit($any($event.target).value || null)">
      <option value="" [selected]="!value()">{{ allLabel() }}</option>
      @for (opt of options(); track opt.value) {
        <option [value]="opt.value" [selected]="value() === opt.value">{{ opt.label }}</option>
      }
    </select>
  `,
  styles: [
    `
      :host { display: contents; }
      .fs { transition: border-color var(--dur-fast), box-shadow var(--dur-fast), color var(--dur-fast); }
      .fs.is-active { border-color: rgba(var(--primary-rgb), 0.45); color: var(--primary-strong); font-weight: 600; }
    `,
  ],
})
export class FilterSelectComponent {
  readonly label = input.required<string>();
  readonly allLabel = input.required<string>();
  readonly options = input.required<readonly FilterOption[]>();
  readonly value = input<string | null | undefined>(null);

  readonly valueChange = output<string | null>();
}

/** Builds options from an enum list + its label map. */
export function toFilterOptions<K extends string>(
  keys: readonly K[],
  label: (key: K) => string,
): FilterOption[] {
  return keys.map((value) => ({ value, label: label(value) }));
}
