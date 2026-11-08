import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { STOCK_LEVEL_LABEL, stockLevel } from '../../models/item.model';

/** Quantity + a bar coloured by stock level; the reorder point sits at one third. */
@Component({
  selector: 'app-stock-meter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-level]': 'level()', '[attr.title]': 'label()' },
  template: `
    <span class="sm__value">{{ stock() }}</span>
    <span class="sm__bar"><i [style.width.%]="fill()"></i></span>
    <span class="visually-hidden">{{ label() }}</span>
  `,
  styles: [
    `
      :host {
        --sm: var(--gr);
        display: inline-flex; flex-direction: column; align-items: center; gap: 4px; min-width: 56px;
      }
      :host([data-level='low']) { --sm: var(--am); }
      :host([data-level='out']) { --sm: var(--re); }
      .sm__value { font-weight: 700; font-size: 13px; color: var(--sm); }
      .sm__bar { width: 100%; height: 5px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
      .sm__bar i {
        display: block; height: 100%; border-radius: inherit; background: var(--sm);
        transform-origin: var(--start); animation: sm-grow 0.8s var(--ease-out) backwards 0.15s;
      }
      @keyframes sm-grow { from { transform: scaleX(0); } }
      @media (prefers-reduced-motion: reduce) { .sm__bar i { animation: none; } }
    `,
  ],
})
export class StockMeterComponent {
  readonly stock = input.required<number>();
  readonly minStock = input.required<number>();

  protected readonly level = computed(() => stockLevel({ stock: this.stock(), minStock: this.minStock() }));
  protected readonly label = computed(() => STOCK_LEVEL_LABEL[this.level()]);
  protected readonly fill = computed(() => {
    const min = this.minStock();
    return min > 0 ? Math.min(100, (this.stock() / (min * 3)) * 100) : 100;
  });
}
