import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { LowStockItem } from '../../models/dashboard.model';

/** At or below this share of the reorder level an item is critical. */
const CRITICAL_RATIO = 0.25;

@Component({
  selector: 'app-low-stock-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <section class="panel">
      <header class="panel__head">
        <div>
          <h2 class="panel__title">تنبيهات نقص المخزون</h2>
          <p class="panel__sub">أصناف تحت حد إعادة الطلب، مرتبة حسب الأولوية</p>
        </div>
        <a class="ls__all" routerLink="/stock">إدارة المخزون <app-icon name="arrow-right" [size]="14" /></a>
      </header>

      <ul class="ls">
        @for (item of rows(); track item.sku; let i = $index) {
          <li class="ls__row" [style.--i]="i">
            <span class="ls__icon" [class.ls__icon--critical]="item.critical">
              <app-icon [name]="item.critical ? 'alert' : 'box'" [size]="15" />
            </span>
            <div class="ls__body">
              <div class="ls__name">{{ item.name }}</div>
              <div class="ls__meta"><span class="ltr">{{ item.sku }}</span> · {{ item.warehouse }}</div>
              <div class="ls__track" [class.ls__track--critical]="item.critical">
                <span class="ls__fill" [style.width.%]="item.pct"></span>
              </div>
            </div>
            <div class="ls__qty">
              <b>{{ item.quantity }}</b>
              <span>من {{ item.reorderLevel }}</span>
              <span class="status-pill" [class]="'status-pill status-pill--' + (item.critical ? 'danger' : 'warning')">
                {{ item.critical ? 'حرج' : 'منخفض' }}
              </span>
            </div>
          </li>
        }
      </ul>
    </section>
  `,
  styleUrl: './low-stock-panel.component.scss',
})
export class LowStockPanelComponent {
  readonly items = input.required<readonly LowStockItem[]>();

  protected readonly rows = computed(() =>
    this.items()
      .map((item) => {
        const ratio = item.quantity / item.reorderLevel;
        return { ...item, pct: Math.min(100, ratio * 100), critical: ratio <= CRITICAL_RATIO, ratio };
      })
      .sort((a, b) => a.ratio - b.ratio),
  );
}
