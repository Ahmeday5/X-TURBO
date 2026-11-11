import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.component';
import { ItemGroupsService } from '../../items/services/item-groups.service';
import { OrdersService } from '../../orders/services/orders.service';
import { StockService } from '../../warehouses/services/stock.service';
import { CampaignRefType } from '../models/notification-campaign.model';

/** Recent app orders offered as link targets (the newest are the ones worth notifying about). */
const RECENT_ORDERS = 100;

/**
 * Options for the "open this screen" link of a campaign, per `refType`,
 * shaped for `app-searchable-select` (search runs client-side over them).
 */
@Injectable({ providedIn: 'root' })
export class CampaignRefOptionsService {
  private readonly stock = inject(StockService);
  private readonly groups = inject(ItemGroupsService);
  private readonly orders = inject(OrdersService);

  load(type: CampaignRefType): Observable<SearchableSelectOption[]> {
    switch (type) {
      case 'product':
        return this.stock
          .itemLookup()
          .pipe(map((items) => items.map((i) => ({ value: i.id, label: i.name, hint: [i.code, i.brand].filter(Boolean).join(' · ') }))));
      case 'category':
        return this.groups.lookup().pipe(map((groups) => groups.map((g) => ({ value: g.id, label: g.name }))));
      case 'order':
        return this.orders
          .list({
            pageIndex: 1,
            pageSize: RECENT_ORDERS,
            search: '',
            sort: { key: 'createdAt', dir: 'desc' },
            filters: { channel: 'online' },
          })
          .pipe(map((page) => page.data.map((o) => ({ value: o.id, label: o.number, hint: o.customerName }))));
    }
  }
}
