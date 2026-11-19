import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { STOCK_LEVEL_LABEL, StockLevel, stockLevel } from '../../models/item.model';

/**
 * Quantity + a bar coloured by stock level; the reorder point sits at one third.
 * Pass the server's `level` for catalogue items (computed on the net, after reservations).
 */
@Component({
  selector: 'app-stock-meter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-level]': 'resolved()', '[attr.title]': 'label()' },
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
  readonly level = input<StockLevel | null>(null);

  protected readonly resolved = computed(() => this.level() ?? stockLevel({ stock: this.stock(), minStock: this.minStock() }));
  protected readonly label = computed(() => STOCK_LEVEL_LABEL[this.resolved()]);
  protected readonly fill = computed(() => {
    const min = this.minStock();
    const value = Math.max(0, this.stock());
    if (this.resolved() === 'out') return 0;
    return min > 0 ? Math.min(100, (value / (min * 3)) * 100) : 100;
  });
}
