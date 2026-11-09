import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DrawerComponent } from '../../../../shared/components/drawer/drawer.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { formatDayMonth, formatInteger, formatMoney } from '../../../../shared/utils/format.util';
import { STOCK_LEVEL_LABEL } from '../../../items/models/item.model';
import { DOC_KIND_CONFIG, DocKind } from '../../../documents/models/document.model';
import { StockService } from '../../services/stock.service';

/**
 * One item across every warehouse: balance split (bars), reserved / available
 * and the latest movements, each linking to its source document.
 * The parent owns `itemId` (bound to a URL param so a refresh reopens it).
 */
@Component({
  selector: 'app-item-stock-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DrawerComponent, IconComponent],
  template: `
    <app-drawer [open]="!!itemId()" label="أرصدة الصنف" (closed)="closed.emit()">
      <div drawer-title>
        @if (details.value(); as d) {
          <span class="ui-code ltr">{{ d.itemCode }}</span>
          <h2 class="isd-title">{{ d.itemName }}</h2>
        } @else {
          <span class="skeleton" style="width: 70px; height: 16px"></span>
          <span class="skeleton" style="display: block; width: 220px; height: 20px; margin-top: 6px"></span>
        }
      </div>

      @if (details.value(); as d) {
        <div class="isd-kpis">
          <div><small>إجمالي الرصيد</small><strong>{{ qty(d.totalQty) }} {{ d.unit }}</strong></div>
          <div><small>تكلفة الوحدة</small><strong>{{ money(d.cost) }}</strong></div>
          <div><small>قيمة الرصيد</small><strong>{{ money(d.totalQty * d.cost) }}</strong></div>
        </div>

        <h3 class="isd-h">التوزيع على المخازن</h3>
        <ul class="isd-split">
          @for (b of d.balances; track b.warehouseId; let i = $index) {
            <li [attr.data-level]="b.level" [style.--i]="i">
              <div class="isd-split__row">
                <strong>{{ b.warehouseName }}</strong>
                <span>{{ qty(b.qty) }} <small>{{ levelLabel[b.level] }}</small></span>
              </div>
              <span class="isd-split__bar"><i [style.width.%]="share(b.qty)"></i></span>
              @if (b.reserved) {
                <small class="isd-split__hint">محجوز {{ qty(b.reserved) }} · متاح {{ qty(b.available) }}</small>
              }
            </li>
          }
        </ul>

        <h3 class="isd-h">آخر الحركات</h3>
        @if (d.movements.length) {
          <ul class="isd-moves">
            @for (m of d.movements; track m.documentId + m.warehouseId) {
              <li>
                <span class="isd-moves__qty" [class.is-in]="m.qty > 0">{{ m.qty > 0 ? '+' : '−' }}{{ qty(abs(m.qty)) }}</span>
                <div class="isd-moves__text">
                  <a [routerLink]="routeOf(m.kind)" [queryParams]="{ doc: m.documentId }">
                    {{ m.kindLabel }} <span class="ltr">{{ m.documentNumber }}</span>
                  </a>
                  <small>{{ m.warehouseName }}@if (m.partyName) { · {{ m.partyName }}}</small>
                </div>
                <time>{{ day(m.date) }}</time>
              </li>
            }
          </ul>
        } @else {
          <p class="isd-empty">لا توجد حركات مسجلة لهذا الصنف.</p>
        }
      } @else if (details.error()) {
        <div class="page-state"><span class="page-state__icon"><app-icon name="alert" [size]="22" /></span><p>{{ details.error() }}</p>
          <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" (click)="details.reload()">إعادة المحاولة</button>
        </div>
      } @else {
        @for (i of [1, 2, 3, 4]; track i) {
          <span class="skeleton" style="display: block; height: 46px; margin-bottom: 10px; border-radius: 12px"></span>
        }
      }

      <div drawer-footer>
        @if (itemId(); as id) {
          <a class="ui-btn ui-btn--ghost" routerLink="/items/define" [queryParams]="{ id }"><app-icon name="edit" [size]="16" /> بطاقة الصنف</a>
          <a class="ui-btn ui-btn--ghost" routerLink="/invoices/transfers" [queryParams]="{ doc: 'new' }"><app-icon name="swap" [size]="16" /> تحويل مخزني</a>
        }
      </div>
    </app-drawer>
  `,
  styles: [
    `
      .isd-title { margin: 4px 0 0; font-size: 16px; font-weight: 700; color: var(--txt); line-height: 1.5; }
      .isd-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px; border-radius: 13px; background: var(--bg3); }
      .isd-kpis > div { display: flex; flex-direction: column; gap: 3px; text-align: center; }
      .isd-kpis small { font-size: 11px; color: var(--txt3); }
      .isd-kpis strong { font-size: 13.5px; color: var(--txt); }
      .isd-h { margin: 20px 0 10px; font-size: 13px; font-weight: 700; color: var(--txt2); }

      .isd-split { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
      .isd-split li { --tone: var(--gr); animation: reveal-up 0.45s var(--ease-out) both; animation-delay: calc(var(--i) * 50ms); }
      .isd-split li[data-level='low'] { --tone: var(--am); }
      .isd-split li[data-level='out'] { --tone: var(--re); }
      .isd-split__row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 12.5px; color: var(--txt); }
      .isd-split__row span { font-weight: 700; color: var(--tone); }
      .isd-split__row small { font-weight: 500; font-size: 10.5px; color: var(--txt3); }
      .isd-split__bar { display: block; height: 7px; margin-top: 6px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
      .isd-split__bar i { display: block; height: 100%; border-radius: inherit; background: var(--tone); transition: width 0.5s var(--ease-out); }
      .isd-split__hint { display: block; margin-top: 4px; font-size: 11px; color: var(--txt3); }

      .isd-moves { list-style: none; margin: 0; padding: 0; }
      .isd-moves li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--brd); }
      .isd-moves li:last-child { border-bottom: 0; }
      .isd-moves__qty {
        flex-shrink: 0; min-width: 52px; padding: 4px 8px; border-radius: 9px; text-align: center;
        font-weight: 700; font-size: 12.5px; background: var(--re-l); color: var(--re); direction: ltr;
      }
      .isd-moves__qty.is-in { background: var(--gr-l); color: var(--gr); }
      .isd-moves__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .isd-moves__text a { font-size: 12.5px; font-weight: 600; color: var(--txt); text-decoration: none; }
      .isd-moves__text a:hover { color: var(--primary); }
      .isd-moves__text small { font-size: 11px; color: var(--txt3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .isd-moves time { flex-shrink: 0; font-size: 11px; color: var(--txt3); }
      .isd-empty { margin: 0; font-size: 12.5px; color: var(--txt3); }
      @media (prefers-reduced-motion: reduce) { .isd-split li { animation: none; } }
    `,
  ],
})
export class ItemStockDrawerComponent {
  private readonly stock = inject(StockService);

  readonly itemId = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly details = createQueryResource(this.itemId, (id) => this.stock.item(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل أرصدة الصنف',
  });

  private readonly maxQty = computed(() => Math.max(1, ...(this.details.value()?.balances.map((b) => b.qty) ?? [1])));

  protected readonly levelLabel = STOCK_LEVEL_LABEL;
  protected readonly qty = formatInteger;
  protected readonly money = formatMoney;
  protected readonly day = formatDayMonth;
  protected readonly abs = Math.abs;

  protected share(qty: number): number {
    return Math.max(0, (qty / this.maxQty()) * 100);
  }

  protected routeOf(kind: string): string {
    return DOC_KIND_CONFIG[kind as DocKind]?.route ?? '/stock';
  }
}
