import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { formatMoney, formatRelative } from '../../../../shared/utils/format.util';
import { initialsOf } from '../../../../shared/utils/initials.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { shouldActivateRow } from '../../../../shared/utils/row-activation.util';
import { OrderDetailsDrawerComponent } from '../../../orders/components/order-details-drawer/order-details-drawer.component';
import { ORDER_ITEMS_PLURAL, ORDER_STATUS_VIEW } from '../../../orders/models/order.model';
import { RecentOrder } from '../../models/dashboard.model';

/**
 * Latest orders on the dashboard. A row (or its eye) opens the full order
 * drawer right here — status changes included — without leaving the dashboard.
 */
@Component({
  selector: 'app-recent-orders-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, OrderDetailsDrawerComponent, RouterLink, StatusPillComponent],
  templateUrl: './recent-orders-panel.component.html',
  styleUrl: './recent-orders-panel.component.scss',
})
export class RecentOrdersPanelComponent {
  readonly orders = input.required<readonly RecentOrder[]>();
  /** An order changed from the drawer — the dashboard should refresh its numbers. */
  readonly changed = output<void>();

  /** Id or number of the order open in the drawer. */
  protected readonly openKey = signal<string | null>(null);

  protected readonly status = ORDER_STATUS_VIEW;
  protected readonly formatMoney = formatMoney;
  protected readonly formatRelative = formatRelative;

  protected label(o: RecentOrder): string {
    return o.number ?? o.id;
  }

  protected open(o: RecentOrder, event?: Event): void {
    if (event && !shouldActivateRow(event)) return;
    this.openKey.set(o.id);
  }

  protected itemsLabel(count: number): string {
    return pluralAr(count, ORDER_ITEMS_PLURAL);
  }

  protected initials(name: string): string {
    return initialsOf(name);
  }
}
