import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ListQuery } from '../../../../core/models/list-query.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { formatInteger, formatMoney } from '../../../../shared/utils/format.util';
import { discountedPrice, Item, STOCK_LEVEL_LABEL, stockLevel } from '../../models/item.model';
import { ItemsService } from '../../services/items.service';

/** Rows fetched per "show more". */
const PAGE_SIZE = 10;

/**
 * The items of one (leaf) group, shown in place under its node in the tree:
 * name / code / price / stock, "show more" paging, and shortcuts to add an
 * item to this group or open the full list in the directory.
 */
@Component({
  selector: 'app-group-items',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  templateUrl: './group-items.component.html',
  styleUrl: './group-items.component.scss',
})
export class GroupItemsComponent {
  private readonly items = inject(ItemsService);

  readonly groupId = input.required<string>();
  readonly groupName = input('');

  /** How many rows are shown — grows with "show more" (one request each time, newest size). */
  protected readonly shown = signal(PAGE_SIZE);
  private readonly query = computed<ListQuery>(() => ({
    pageIndex: 1,
    pageSize: this.shown(),
    search: '',
    sort: { key: 'name', dir: 'asc' },
    filters: { groupId: this.groupId() },
  }));
  protected readonly page = createQueryResource(this.query, (q) => this.items.list(q), {
    errorMessage: 'تعذّر تحميل أصناف المجموعة',
  });

  protected readonly rows = computed(() => this.page.value()?.data ?? []);
  protected readonly total = computed(() => this.page.value()?.count ?? 0);
  protected readonly remaining = computed(() => Math.max(0, this.total() - this.rows().length));

  protected readonly money = formatMoney;
  protected readonly integer = formatInteger;
  protected readonly level = stockLevel;
  protected readonly levelLabel = STOCK_LEVEL_LABEL;
  protected readonly discounted = (i: Item) => discountedPrice(i.salePrice, i.discountPercent);

  protected showMore(): void {
    this.shown.update((n) => n + PAGE_SIZE);
  }
}
