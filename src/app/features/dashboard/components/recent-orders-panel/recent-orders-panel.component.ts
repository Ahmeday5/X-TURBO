import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatMoney, formatRelative } from '../../../../shared/utils/format.util';
import { initialsOf } from '../../../../shared/utils/initials.util';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { ORDER_ITEMS_PLURAL, ORDER_STATUS_VIEW } from '../../../orders/models/order.model';
import { RecentOrder } from '../../models/dashboard.model';

@Component({
  selector: 'app-recent-orders-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink, StatusPillComponent],
  templateUrl: './recent-orders-panel.component.html',
  styleUrl: './recent-orders-panel.component.scss',
})
export class RecentOrdersPanelComponent {
  readonly orders = input.required<readonly RecentOrder[]>();

  protected readonly status = ORDER_STATUS_VIEW;
  protected readonly formatMoney = formatMoney;
  protected readonly formatRelative = formatRelative;

  protected itemsLabel(count: number): string {
    return pluralAr(count, ORDER_ITEMS_PLURAL);
  }

  protected initials(name: string): string {
    return initialsOf(name);
  }
}
