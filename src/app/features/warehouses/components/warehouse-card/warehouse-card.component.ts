import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatCompact, formatMoneyCompact } from '../../../../shared/utils/format.util';
import { usageTone, Warehouse, WAREHOUSE_TYPE_VIEW } from '../../models/warehouse.model';

/** Fields the card needs — a saved warehouse or the form's live draft both fit. */
export type WarehouseCardData = Pick<
  Warehouse,
  | 'code'
  | 'name'
  | 'type'
  | 'city'
  | 'manager'
  | 'capacity'
  | 'isDefault'
  | 'isActive'
  | 'itemsCount'
  | 'totalQty'
  | 'stockValue'
  | 'lowStockCount'
  | 'usagePct'
>;

/** Warehouse summary: identity, capacity usage and stock figures. Directory cards + form preview. */
@Component({
  selector: 'app-warehouse-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @let w = warehouse();
    <header class="wc__head">
      <span class="wc__icon" [style.--tone]="typeView().color"><app-icon name="warehouse" [size]="22" /></span>
      <div class="wc__title">
        <span class="ui-code ltr">{{ w.code || '—' }}</span>
        <h3>{{ w.name || 'اسم المخزن' }}</h3>
        <small><app-icon name="target" [size]="12" /> {{ w.city || 'المدينة' }}@if (w.manager) { · {{ w.manager }}}</small>
      </div>
    </header>

    <div class="wc__tags">
      <span [class]="'status-pill status-pill--' + typeView().tone">{{ typeView().label }}</span>
      @if (w.isDefault) {
        <span class="status-pill status-pill--info">الافتراضي</span>
      }
      @if (!w.isActive) {
        <span class="status-pill status-pill--neutral">موقوف</span>
      }
    </div>

    <div class="wc__usage" [attr.data-tone]="tone()">
      <div class="wc__usage-row">
        <span>الإشغال</span>
        <strong>{{ w.capacity ? w.usagePct + '%' : 'غير محدد' }}</strong>
      </div>
      <span class="wc__bar"><i [style.width.%]="fill()"></i></span>
      <small>{{ qty(w.totalQty) }} من {{ w.capacity ? qty(w.capacity) : '—' }} وحدة</small>
    </div>

    <div class="wc__stats">
      <div>
        <small>الأصناف</small>
        <strong>{{ qty(w.itemsCount) }}</strong>
      </div>
      <div>
        <small>قيمة المخزون</small>
        <strong>{{ money(w.stockValue) }}</strong>
      </div>
      <div [class.is-warn]="w.lowStockCount > 0">
        <small>تحت حد الطلب</small>
        <strong>{{ qty(w.lowStockCount) }}</strong>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .wc__head { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .wc__icon {
        flex-shrink: 0; width: 46px; height: 46px; display: grid; place-items: center; border-radius: 14px;
        color: var(--tone); background: color-mix(in srgb, var(--tone) 13%, transparent);
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      :host-context(.dt__card:hover) .wc__icon { transform: rotate(-8deg) scale(1.08); }
      .wc__title { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .wc__title h3 {
        margin: 0; font-size: 15px; font-weight: 700; color: var(--txt);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .wc__title small { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--txt3); }
      .wc__tags { display: flex; flex-wrap: wrap; gap: 6px; }

      .wc__usage { --tone: var(--gr); display: flex; flex-direction: column; gap: 5px; }
      .wc__usage[data-tone='warning'] { --tone: var(--am); }
      .wc__usage[data-tone='danger'] { --tone: var(--re); }
      .wc__usage-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--txt2); }
      .wc__usage-row strong { color: var(--tone); }
      .wc__usage small { font-size: 11px; color: var(--txt3); }
      .wc__bar { height: 7px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
      .wc__bar i {
        display: block; height: 100%; border-radius: inherit; background: var(--tone);
        transform-origin: var(--start); animation: wc-grow 0.9s var(--ease-out) backwards 0.15s;
        transition: width 0.5s var(--ease-out);
      }

      .wc__stats {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 10px;
        border-radius: 11px; background: var(--bg3);
      }
      .wc__stats > div { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; text-align: center; }
      .wc__stats small { font-size: 10.5px; color: var(--txt3); white-space: nowrap; }
      .wc__stats strong { font-size: 13px; color: var(--txt); white-space: nowrap; }
      .wc__stats .is-warn strong { color: var(--am); }

      @keyframes wc-grow { from { transform: scaleX(0); } }
      @media (prefers-reduced-motion: reduce) { .wc__bar i { animation: none; } }
    `,
  ],
})
export class WarehouseCardComponent {
  readonly warehouse = input.required<WarehouseCardData>();

  protected readonly typeView = computed(() => WAREHOUSE_TYPE_VIEW[this.warehouse().type]);
  protected readonly tone = computed(() => usageTone(this.warehouse().usagePct));
  protected readonly fill = computed(() => Math.min(100, this.warehouse().usagePct));

  protected readonly qty = formatCompact;
  protected readonly money = formatMoneyCompact;
}
