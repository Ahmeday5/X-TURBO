import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CountUpDirective } from '../../../../shared/directives/count-up.directive';
import { formatInteger } from '../../../../shared/utils/format.util';
import { ORDER_STATUSES, ORDER_STATUS_VIEW, OrderStats, OrderStatus } from '../../models/order.model';

interface Tab {
  value: OrderStatus | null;
  label: string;
  color: string;
  count: number;
}

/** Status quick-filter: "all" + one tab per status, each with its live count. */
@Component({
  selector: 'app-order-status-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountUpDirective],
  template: `
    <div class="ost" role="tablist" aria-label="تصفية حسب الحالة">
      @for (t of tabs(); track t.label; let i = $index) {
        <button type="button" role="tab" class="ost__tab" [style.--c]="t.color" [style.--i]="i"
          [attr.aria-selected]="active() === t.value" (click)="statusChange.emit(t.value)">
          <span class="ost__dot"></span>
          <span class="ost__label">{{ t.label }}</span>
          <span class="ost__count" [appCountUp]="t.count" [countUpFormat]="format"></span>
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; margin-bottom: 14px; }
      .ost {
        display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 6px;
        scroll-snap-type: x proximity; scrollbar-width: none;
      }
      .ost::-webkit-scrollbar { display: none; }
      .ost__tab {
        --c: var(--txt2);
        position: relative; flex: 0 0 auto; scroll-snap-align: start;
        display: inline-flex; align-items: center; gap: 8px;
        padding: 9px 14px; border-radius: 12px; cursor: pointer;
        border: 1px solid var(--brd); background: var(--bg2); color: var(--txt2);
        font: inherit; font-size: 12.5px; font-weight: 600;
        transition: color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out),
          background var(--dur) var(--ease-out), transform var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out);
        animation: reveal-up 0.5s var(--ease-out) both; animation-delay: calc(var(--i) * 45ms);
      }
      .ost__tab:hover { color: var(--txt); transform: translateY(-1px); border-color: var(--brd2); }
      .ost__tab:focus-visible { outline: none; box-shadow: var(--focus-ring); }
      .ost__tab[aria-selected='true'] {
        color: var(--c); border-color: color-mix(in srgb, var(--c) 45%, transparent);
        background: color-mix(in srgb, var(--c) 9%, var(--bg2));
        box-shadow: 0 8px 20px -14px var(--c);
      }
      .ost__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); transition: transform var(--dur) var(--ease-out); }
      .ost__tab[aria-selected='true'] .ost__dot { transform: scale(1.35); }
      .ost__count {
        min-width: 26px; padding: 1px 7px; border-radius: 999px; text-align: center;
        font-size: 11px; font-variant-numeric: tabular-nums; background: var(--bg3); color: var(--txt2);
        transition: background var(--dur), color var(--dur);
      }
      .ost__tab[aria-selected='true'] .ost__count { background: var(--c); color: #fff; }
      @media (prefers-reduced-motion: reduce) { .ost__tab { animation: none; } }
    `,
  ],
})
export class OrderStatusTabsComponent {
  readonly stats = input<OrderStats | null>(null);
  readonly active = input<OrderStatus | null>(null);
  readonly statusChange = output<OrderStatus | null>();

  protected readonly format = formatInteger;

  protected readonly tabs = computed<Tab[]>(() => {
    const s = this.stats();
    return [
      { value: null, label: 'الكل', color: 'var(--primary)', count: s?.count ?? 0 },
      ...ORDER_STATUSES.map((status) => ({
        value: status,
        label: ORDER_STATUS_VIEW[status].label,
        color: ORDER_STATUS_VIEW[status].color,
        count: s?.byStatus[status] ?? 0,
      })),
    ];
  });
}
