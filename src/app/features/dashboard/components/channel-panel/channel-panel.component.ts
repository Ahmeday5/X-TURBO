import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BarListComponent, BarListRow } from '../../../../shared/components/charts/bar-list/bar-list.component';
import { formatInteger, formatMoney, formatMoneyCompact } from '../../../../shared/utils/format.util';
import { ChannelSales } from '../../models/dashboard.model';

/** Revenue share per sales channel, plus each channel's average ticket. */
@Component({
  selector: 'app-channel-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarListComponent],
  template: `
    <section class="panel cp">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">المبيعات حسب القناة</h2>
          <p class="panel__sub">حصة الإيراد · {{ period() }}</p>
        </div>
      </header>

      <app-bar-list [items]="rows()" />

      <footer class="cp__foot">
        <div class="cp__foot-title">متوسط قيمة الطلب</div>
        <dl class="cp__aov">
          @for (c of aov(); track c.channel) {
            <div class="cp__aov-item">
              <dt>{{ c.channel }}</dt>
              <dd>{{ c.value }}</dd>
            </div>
          }
        </dl>
      </footer>
    </section>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .cp { display: flex; flex-direction: column; }
      .cp__foot { margin-top: auto; padding-top: 18px; }
      .cp__foot-title {
        margin-bottom: 10px; font-size: 10.5px; font-weight: 700;
        color: var(--txt3);
      }
      .cp__aov { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }
      .cp__aov-item { padding: 10px 11px; border-radius: 12px; background: var(--bg3); min-width: 0; }
      .cp__aov-item dt {
        font-size: 11px; font-weight: 500; color: var(--txt2);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .cp__aov-item dd { margin: 3px 0 0; font-size: 13px; font-weight: 700; color: var(--txt); font-variant-numeric: tabular-nums; }
    `,
  ],
})
export class ChannelPanelComponent {
  readonly channels = input.required<readonly ChannelSales[]>();
  readonly period = input.required<string>();

  protected readonly rows = computed<BarListRow[]>(() => {
    const channels = this.channels();
    const total = channels.reduce((sum, c) => sum + c.revenue, 0) || 1;
    return channels.map((c) => ({
      key: c.channel,
      label: c.channel,
      sub: `${formatInteger(c.orders)} طلب · ${Math.round((c.revenue / total) * 100)}% من الإيراد`,
      value: c.revenue,
      display: formatMoneyCompact(c.revenue),
    }));
  });

  protected readonly aov = computed(() =>
    this.channels().map((c) => ({
      channel: c.channel,
      value: c.orders ? formatMoney(Math.round(c.revenue / c.orders)) : '—',
    })),
  );
}
