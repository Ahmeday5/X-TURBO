import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { formatMoney } from '../../../../shared/utils/format.util';
import { Party, PARTY_KIND_VIEW, PRICE_LIST_LABEL } from '../../models/party.model';
import { balanceTone, formatBalance } from '../../utils/party-display.util';

export type PartyCardData = Pick<
  Party,
  'code' | 'kind' | 'name' | 'phone' | 'city' | 'priceList' | 'creditLimit' | 'paymentTermDays' | 'isActive' | 'isExternal' | 'balance'
>;

/** Party summary card — list card view and the live preview of the form. */
@Component({
  selector: 'app-party-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, StatusPillComponent],
  template: `
    <header class="pc__head">
      <app-avatar [name]="party().name || '؟'" [size]="44" />
      <div class="pc__title">
        <span class="ui-code ltr">{{ party().code }}</span>
        <h3>{{ party().name || 'اسم العميل / المورد' }}</h3>
      </div>
    </header>

    <div class="pc__chips">
      <app-status-pill [view]="kindView()" />
      @if (party().isExternal) {<span class="status-pill status-pill--neutral">عميل خارجي</span>}
      @if (!party().isActive) {<span class="status-pill status-pill--danger">موقوف</span>}
    </div>

    <dl class="pc__meta">
      <div><dt><app-icon name="user" [size]="13" /> الهاتف</dt><dd class="ltr">{{ party().phone || '—' }}</dd></div>
      <div><dt><app-icon name="home" [size]="13" /> المدينة</dt><dd>{{ party().city || '—' }}</dd></div>
      <div><dt><app-icon name="tag" [size]="13" /> قائمة الأسعار</dt><dd>{{ priceList[party().priceList] }}</dd></div>
      <div>
        <dt><app-icon name="clock" [size]="13" /> الائتمان</dt>
        <dd>{{ party().creditLimit ? money(party().creditLimit) : 'بدون حد' }}{{ party().paymentTermDays ? ' · ' + party().paymentTermDays + ' يوم' : '' }}</dd>
      </div>
    </dl>

    <footer [class]="'pc__balance pc__balance--' + tone()">
      <span>الرصيد الحالي</span>
      <strong>{{ balanceText() }}</strong>
      @if (usage() !== null) {
        <div class="pc__bar" [attr.aria-label]="'استخدام حد الائتمان ' + usage() + '%'">
          <i [style.width.%]="usage()! > 100 ? 100 : usage()" [class.is-over]="usage()! > 100"></i>
        </div>
      }
    </footer>
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .pc__head { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .pc__title { min-width: 0; }
      .pc__title h3 { margin: 2px 0 0; font-size: 14px; font-weight: 700; color: var(--txt); line-height: 1.45; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pc__chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .pc__meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
      .pc__meta dt { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: var(--txt3); }
      .pc__meta dd { margin: 2px 0 0; font-size: 12.5px; color: var(--txt); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pc__balance { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 12px; background: var(--bg3); }
      .pc__balance span { font-size: 11px; font-weight: 600; color: var(--txt3); }
      .pc__balance strong { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--txt); }
      .pc__balance--info { background: var(--bl-l); }
      .pc__balance--info strong { color: var(--bl); }
      .pc__balance--warning { background: var(--am-l); }
      .pc__balance--warning strong { color: var(--am); }
      .pc__bar { height: 5px; margin-top: 4px; border-radius: 99px; background: color-mix(in srgb, var(--txt3) 18%, transparent); overflow: hidden; }
      .pc__bar i { display: block; height: 100%; border-radius: inherit; background: var(--bl); transition: width 0.6s var(--ease-out); }
      .pc__bar i.is-over { background: var(--re); }
    `,
  ],
})
export class PartyCardComponent {
  readonly party = input.required<PartyCardData>();

  protected readonly priceList = PRICE_LIST_LABEL;
  protected readonly money = formatMoney;
  protected readonly kindView = computed(() => PARTY_KIND_VIEW[this.party().kind]);
  protected readonly tone = computed(() => balanceTone(this.party().balance));
  protected readonly balanceText = computed(() => formatBalance(this.party().balance));
  /** Credit-limit usage % (customers with a limit and a debit balance). */
  protected readonly usage = computed(() => {
    const p = this.party();
    return p.creditLimit > 0 && p.kind !== 'supplier' ? Math.max(0, Math.round((p.balance / p.creditLimit) * 100)) : null;
  });
}
