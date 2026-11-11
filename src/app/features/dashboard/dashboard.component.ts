import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { combineLatest, EMPTY, Subject } from 'rxjs';
import { catchError, startWith, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../../core/auth/services/auth.service';
import { ApiError } from '../../core/models/api-response.model';
import {
  BarListComponent,
  BarListRow,
} from '../../shared/components/charts/bar-list/bar-list.component';
import {
  IconComponent,
  IconName,
} from '../../shared/components/icon/icon.component';
import {
  formatInteger,
  businessHour,
  formatLongDate,
  formatMoney,
  formatMoneyCompact,
} from '../../shared/utils/format.util';
import { ChannelPanelComponent } from './components/channel-panel/channel-panel.component';
import { KpiCardComponent, KpiEmptyNote } from '../../shared/components/kpi-card/kpi-card.component';
import { LowStockPanelComponent } from './components/low-stock-panel/low-stock-panel.component';
import { RecentOrdersPanelComponent } from './components/recent-orders-panel/recent-orders-panel.component';
import { RevenuePanelComponent } from './components/revenue-panel/revenue-panel.component';
import { WarehousePanelComponent } from './components/warehouse-panel/warehouse-panel.component';
import {
  DashboardKpis,
  DashboardOverview,
  DashboardRange,
} from './models/dashboard.model';
import { DashboardService } from './services/dashboard.service';

interface KpiCardConfig {
  key: keyof DashboardKpis;
  label: string;
  icon: IconName;
  format: (value: number) => string;
  upIsGood: boolean;
  /** Screen the tile opens. */
  link: string;
  linkParams?: Record<string, string>;
  /** What a zero means, in words. */
  emptyNote: KpiEmptyNote;
}

const KPI_CARDS: readonly KpiCardConfig[] = [
  {
    key: 'orders',
    label: 'الطلبات',
    icon: 'cart',
    format: formatInteger,
    upIsGood: true,
    link: '/orders',
    emptyNote: { text: 'لا توجد طلبات في هذه الفترة', tone: 'neutral' },
  },
  {
    key: 'avgOrderValue',
    label: 'متوسط قيمة الطلب',
    icon: 'receipt',
    format: formatMoney,
    upIsGood: true,
    link: '/reports',
    emptyNote: { text: 'يُحسب بعد أول طلب', tone: 'neutral' },
  },
  {
    key: 'inventoryValue',
    label: 'قيمة المخزون',
    icon: 'layers',
    format: formatMoneyCompact,
    upIsGood: true,
    link: '/stock',
    emptyNote: { text: 'لا يوجد مخزون حاليًا', tone: 'neutral' },
  },
  {
    key: 'lowStockSkus',
    label: 'أصناف تحت حد الطلب',
    icon: 'alert',
    format: formatInteger,
    upIsGood: false,
    link: '/stock',
    linkParams: { level: 'low' },
    emptyNote: { text: 'كل الأصناف فوق حد الطلب', tone: 'good' },
  },
];

const RANGES: ReadonlyArray<{
  value: DashboardRange;
  label: string;
  period: string;
  /** Phrase for deltas vs the previous period of equal length. */
  previous: string;
}> = [
  { value: '7d', label: '7 أيام', period: 'آخر 7 أيام', previous: 'مقارنة بالـ 7 أيام السابقة' },
  { value: '30d', label: '30 يومًا', period: 'آخر 30 يومًا', previous: 'مقارنة بالـ 30 يومًا السابقة' },
  { value: '90d', label: '90 يومًا', period: 'آخر 90 يومًا', previous: 'مقارنة بالـ 90 يومًا السابقة' },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    BarListComponent,
    ChannelPanelComponent,
    IconComponent,
    KpiCardComponent,
    LowStockPanelComponent,
    RecentOrdersPanelComponent,
    RevenuePanelComponent,
    WarehousePanelComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly service = inject(DashboardService);
  private readonly auth = inject(AuthService);

  protected readonly ranges = RANGES;
  protected readonly kpiCards = KPI_CARDS;

  protected readonly range = signal<DashboardRange>('30d');
  protected readonly data = signal<DashboardOverview | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly reload$ = new Subject<void>();

  protected readonly today = formatLongDate(new Date());
  protected readonly greeting = computed(() => {
    const part = businessHour() < 12 ? 'صباح الخير' : 'مساء الخير';
    const first = this.auth.currentUser()?.name.split(/\s+/)[0];
    return first ? `${part}، ${first}` : part;
  });

  private readonly activeRange = computed(() => RANGES.find((r) => r.value === this.range()) ?? RANGES[1]);
  protected readonly period = computed(() => this.activeRange().period);
  protected readonly comparison = computed(() => this.activeRange().previous);

  protected readonly productRows = computed<BarListRow[]>(() =>
    (this.data()?.topProducts ?? []).map((p) => ({
      key: p.sku,
      label: p.name,
      sub: `${p.category} · ${formatInteger(p.unitsSold)} قطعة مباعة`,
      value: p.revenue,
      display: formatMoneyCompact(p.revenue),
    })),
  );

  constructor() {
    combineLatest([
      toObservable(this.range),
      this.reload$.pipe(startWith(undefined)),
    ])
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(([range]) =>
          this.service.getOverview(range).pipe(
            catchError((err: ApiError) => {
              this.error.set(err.message);
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((overview) => {
        this.data.set(overview);
        this.error.set(null);
        this.loading.set(false);
      });
  }

  protected setRange(range: DashboardRange): void {
    this.range.set(range);
  }

  protected reload(): void {
    this.reload$.next();
  }
}
