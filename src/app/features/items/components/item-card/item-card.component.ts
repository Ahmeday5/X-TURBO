import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatMoney } from '../../../../shared/utils/format.util';
import { Item, marginPct } from '../../models/item.model';
import { StockMeterComponent } from '../stock-meter/stock-meter.component';

/** Fields the card needs — a saved Item or the form's live draft both fit. */
export type ItemCardData = Pick<
  Item,
  'code' | 'name' | 'groupName' | 'groupColor' | 'unit' | 'salePrice' | 'purchasePrice' | 'stock' | 'minStock' | 'isActive'
>;

/** Item summary used by the directory's card view and the form's live preview. */
@Component({
  selector: 'app-item-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, StockMeterComponent],
  templateUrl: './item-card.component.html',
  styleUrl: './item-card.component.scss',
})
export class ItemCardComponent {
  readonly item = input.required<ItemCardData>();

  protected readonly price = computed(() => formatMoney(this.item().salePrice || 0));
  protected readonly margin = computed(() => marginPct(this.item().purchasePrice || 0, this.item().salePrice || 0));
}
