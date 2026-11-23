import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { CarFilter, EMPTY_CAR_FILTER, isCarFilterActive } from '../../models/car-filter.model';
import { StoreCarsService } from '../../services/store-cars.service';

/**
 * Cascading "parts for this car" filter: make → model → year. Changing a
 * level clears the ones below it. Stateless — the parent owns the value
 * (typically in the URL) and passes it back in.
 *
 *   <app-car-filter [value]="car()" (valueChange)="state.setFilters($event)" />
 */
@Component({
  selector: 'app-car-filter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="cf" role="group" aria-label="تصفية حسب العربية">
      <span class="cf__icon" aria-hidden="true"><app-icon name="car" [size]="15" /></span>

      <select class="ui-input cf__select" [class.is-active]="!!value().makeId" aria-label="الماركة"
        [disabled]="makes.loading() && !makes.value()" (change)="setMake($any($event.target).value)">
        <option value="" [selected]="!value().makeId">{{ makes.error() ? 'تعذّر تحميل الماركات' : 'كل الماركات' }}</option>
        @for (m of makes.value() ?? []; track m.id) {
          <option [value]="m.id" [selected]="m.id === value().makeId">{{ m.name }}</option>
        }
      </select>

      <select class="ui-input cf__select" [class.is-active]="!!value().modelId" aria-label="النوع"
        [disabled]="!value().makeId" (change)="setModel($any($event.target).value)">
        <option value="" [selected]="!value().modelId">{{ value().makeId ? (models.loading() ? 'جارٍ التحميل…' : 'كل الأنواع') : 'النوع' }}</option>
        @for (m of modelOptions(); track m.id) {
          <option [value]="m.id" [selected]="m.id === value().modelId">{{ m.name }}</option>
        }
      </select>

      <select class="ui-input cf__select cf__select--year" [class.is-active]="!!value().year" aria-label="الموديل (السنة)"
        [disabled]="!value().modelId" (change)="setYear($any($event.target).value)">
        <option value="" [selected]="!value().year">{{ value().modelId ? (years.loading() ? 'جارٍ التحميل…' : 'كل السنين') : 'السنة' }}</option>
        @for (y of yearOptions(); track y) {
          <option [value]="y" [selected]="'' + y === value().year">{{ y }}</option>
        }
      </select>

      @if (active()) {
        <button type="button" class="ui-icon-btn cf__clear" title="مسح فلتر العربية" aria-label="مسح فلتر العربية" (click)="clear()">
          <app-icon name="x" [size]="14" />
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: contents; }
      .cf { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
      .cf__icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: var(--txt3); background: var(--bg3); }
      .cf__select { width: auto; min-width: 118px; max-width: 170px; }
      .cf__select--year { min-width: 96px; }
      /* Inside a list toolbar's filter grid: make/model/year share two columns, the whole row when narrow. */
      :host-context(.lt__filters) .cf { display: flex; flex-wrap: nowrap; grid-column: span 2; min-width: 0; }
      :host-context(.lt__filters) .cf__select { flex: 1 1 0; width: auto; min-width: 0; max-width: none; }
      @container lt-filters (max-width: 420px) {
        :host-context(.lt__filters) .cf { grid-column: 1 / -1; }
      }
      .cf__select.is-active { border-color: var(--primary); color: var(--primary-strong); }
      .cf__select:disabled { opacity: 0.55; cursor: not-allowed; }
      @media (max-width: 575.98px) {
        .cf { width: 100%; }
        .cf__select { flex: 1 1 30%; min-width: 0; max-width: none; }
        .cf__icon { display: none; }
      }
    `,
  ],
})
export class CarFilterComponent {
  private readonly cars = inject(StoreCarsService);

  readonly value = input<CarFilter>(EMPTY_CAR_FILTER);
  readonly valueChange = output<CarFilter>();

  protected readonly makes = createQueryResource(signal(true), () => this.cars.makes(), {
    errorMessage: 'تعذّر تحميل الماركات',
  });

  private readonly makeId = computed(() => this.value().makeId);
  protected readonly models = createQueryResource(this.makeId, (id) => this.cars.models(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل الأنواع',
  });

  private readonly modelId = computed(() => this.value().modelId);
  protected readonly years = createQueryResource(this.modelId, (id) => this.cars.years(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل السنين',
  });

  /** Only the answer for the current parent — no flash of the previous make's models. */
  protected readonly modelOptions = computed(() => {
    const id = this.makeId();
    return id ? (this.models.value() ?? []).filter((m) => m.makeId === id) : [];
  });
  protected readonly yearOptions = computed(() => (this.modelId() && !this.years.loading() ? (this.years.value() ?? []) : []));

  protected readonly active = computed(() => isCarFilterActive(this.value()));

  protected setMake(id: string): void {
    this.emit({ makeId: id || null, modelId: null, year: null });
  }

  protected setModel(id: string): void {
    this.emit({ ...this.value(), modelId: id || null, year: null });
  }

  protected setYear(year: string): void {
    this.emit({ ...this.value(), year: year || null });
  }

  protected clear(): void {
    this.emit(EMPTY_CAR_FILTER);
  }

  private emit(next: CarFilter): void {
    const v = this.value();
    if (next.makeId !== v.makeId || next.modelId !== v.modelId || next.year !== v.year) this.valueChange.emit(next);
  }
}
