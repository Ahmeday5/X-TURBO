import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { formatMoney, formatRelative } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import {
  CHANNEL_LABEL,
  ORDER_ITEMS_PLURAL,
  ORDER_STATUS_VIEW,
  OrderSummary,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_VIEW,
} from '../../models/order.model';
import { OrderProgressComponent } from '../order-progress/order-progress.component';

/** Order summary for the card view (and every phone). */
@Component({
  selector: 'app-order-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, StatusPillComponent, OrderProgressComponent],
  template: `
    @let o = order();
    <header class="oc__head">
      <div>
        <span class="ui-code ltr">{{ o.number }}</span>
        <span class="oc__time"><app-icon name="clock" [size]="11" /> {{ relative(o.createdAt) }}</span>
      </div>
      <app-status-pill [view]="statusView[o.status]" />
    </header>

    <div class="oc__customer">
      <app-avatar [name]="o.customerName" [size]="38" />
      <div class="oc__who">
        <strong>{{ o.customerName }}</strong>
        <span>{{ o.city }} · {{ channel[o.channel] }}</span>
      </div>
    </div>

    <app-order-progress [status]="o.status" [compact]="true" />

    <footer class="oc__foot">
      <div class="oc__total">
        <strong>{{ money(o.total) }}</strong>
        <small>{{ items(o.itemCount) }} · {{ method[o.paymentMethod] }}</small>
      </div>
      <app-status-pill [view]="paymentView[o.paymentStatus]" />
    </footer>
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
      .oc__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
      .oc__head > div { display: flex; flex-direction: column; gap: 4px; }
      .oc__time { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--txt3); }
      .oc__customer { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .oc__customer app-avatar { transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
      :host-context(.dt__card:hover) .oc__customer app-avatar { transform: rotate(-8deg) scale(1.08); }
      .oc__who { display: flex; flex-direction: column; min-width: 0; }
      .oc__who strong { font-size: 13.5px; color: var(--txt); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .oc__who span { font-size: 11.5px; color: var(--txt3); }
      .oc__foot {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 10px 12px; border-radius: 11px; background: var(--bg3);
      }
      .oc__total { display: flex; flex-direction: column; min-width: 0; }
      .oc__total strong { font-size: 15px; color: var(--txt); font-variant-numeric: tabular-nums; }
      .oc__total small { font-size: 11px; color: var(--txt3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    `,
  ],
})
export class OrderCardComponent {
  readonly order = input.required<OrderSummary>();

  protected readonly statusView = ORDER_STATUS_VIEW;
  protected readonly paymentView = PAYMENT_STATUS_VIEW;
  protected readonly channel = CHANNEL_LABEL;
  protected readonly method = PAYMENT_METHOD_LABEL;
  protected readonly money = formatMoney;
  protected readonly relative = formatRelative;
  protected readonly items = (n: number) => pluralAr(n, ORDER_ITEMS_PLURAL);
}
