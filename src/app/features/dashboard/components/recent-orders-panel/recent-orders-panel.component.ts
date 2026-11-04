import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatMoney, formatRelative } from '../../../../shared/utils/format.util';
import { initialsOf } from '../../../../shared/utils/initials.util';
import { ArabicPluralForms, pluralAr } from '../../../../shared/utils/plural.util';
import { OrderStatus, RecentOrder } from '../../models/dashboard.model';

const STATUS_VIEW: Record<OrderStatus, { label: string; tone: string }> = {
  pending: { label: 'قيد الانتظار', tone: 'warning' },
  processing: { label: 'قيد التجهيز', tone: 'info' },
  shipped: { label: 'تم الشحن', tone: 'info' },
  delivered: { label: 'تم التسليم', tone: 'good' },
  cancelled: { label: 'ملغي', tone: 'danger' },
};

const ITEMS: ArabicPluralForms = {
  one: 'قطعة واحدة',
  two: 'قطعتان',
  few: '# قطع',
  other: '# قطعة',
};

@Component({
  selector: 'app-recent-orders-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  templateUrl: './recent-orders-panel.component.html',
  styleUrl: './recent-orders-panel.component.scss',
})
export class RecentOrdersPanelComponent {
  readonly orders = input.required<readonly RecentOrder[]>();

  protected readonly status = STATUS_VIEW;
  protected readonly formatMoney = formatMoney;
  protected readonly formatRelative = formatRelative;

  protected itemsLabel(count: number): string {
    return pluralAr(count, ITEMS);
  }

  protected initials(name: string): string {
    return initialsOf(name);
  }
}
