import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ListQuery } from '../../../../core/models/list-query.model';
import { ToastService } from '../../../../core/services/toast.service';
import { fetchAllPages } from '../../../../core/utils/api-list.util';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { FilterOption, FilterSelectComponent } from '../../../../shared/components/filter-select/filter-select.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { SummaryTile, SummaryTilesComponent } from '../../../../shared/components/summary-tiles/summary-tiles.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { downloadCsv } from '../../../../shared/utils/csv.util';
import { todayIsoDate } from '../../../../shared/utils/date-iso.util';
import { formatDayMonth, formatInteger, formatMoney, formatMoneyCompact } from '../../../../shared/utils/format.util';
import {
  BALANCE_SIDE_LABEL,
  balanceSide,
  PartyBalanceRow,
  PARTY_KIND_VIEW,
} from '../../models/party.model';
import { PartiesService } from '../../services/parties.service';
import { balanceTone } from '../../utils/party-display.util';

interface BalancesQuery {
  list: ListQuery;
  asOf: string | null;
}

/** Customers / suppliers balances as of a date (`?asOf=`), with totals and credit-limit usage. */
@Component({
  selector: 'app-party-balances',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DataTableComponent,
    FilterSelectComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    RowTemplateDirective,
    StatusPillComponent,
    SummaryTilesComponent,
  ],
  templateUrl: './party-balances.page.html',
  styleUrl: './party-balances.page.scss',
})
export class PartyBalancesPage {
  private readonly parties = inject(PartiesService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 25,
    defaultSort: { key: 'balance', dir: 'desc' },
    filters: ['kind', 'side', 'overLimit', 'hideZero'],
  });
  protected readonly asOf = this.state.param('asOf');
  protected readonly today = todayIsoDate();

  private readonly query = computed<BalancesQuery>(
    () => ({ list: this.state.query(), asOf: this.asOf() || null }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly page = createQueryResource(this.query, (q) => this.parties.balances(q.list, q.asOf));
  /** Same surface as `createListResource`, keyed on list query + `asOf`. */
  protected readonly list = {
    items: computed(() => this.page.value()?.data ?? []),
    count: computed(() => this.page.value()?.count ?? 0),
    totalPages: computed(() => this.page.value()?.totalPages ?? 0),
    loading: this.page.loading,
    initialLoading: computed(() => this.page.loading() && !this.page.value()),
    error: this.page.error,
    reload: () => this.page.reload(),
  };
  protected readonly summary = createQueryResource(this.query, (q) => this.parties.balancesSummary(q.list, q.asOf));

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const s = this.summary.value();
    return [
      { label: 'مستحق للمتجر', icon: 'cash-in', value: s?.receivable ?? null, format: formatMoneyCompact, tone: 'var(--bl)' },
      { label: 'مستحق على المتجر', icon: 'cash-out', value: s?.payable ?? null, format: formatMoneyCompact, tone: 'var(--am)' },
      {
        label: 'الصافي',
        icon: 'scale',
        value: s?.net ?? null,
        format: (v) => `${formatMoneyCompact(Math.abs(v))} ${v >= 0 ? 'لصالح المتجر' : 'على المتجر'}`,
        tone: 'var(--te)',
      },
      { label: 'تجاوزوا حد الائتمان', icon: 'alert', value: s?.overLimitCount ?? null, format: formatInteger, tone: 'var(--re)' },
    ];
  });

  protected readonly kindOptions: FilterOption[] = [
    { value: 'customer', label: 'العملاء' },
    { value: 'supplier', label: 'الموردون' },
    { value: 'both', label: 'عميل ومورد' },
  ];
  protected readonly sideOptions: FilterOption[] = [
    { value: 'debit', label: 'مدين' },
    { value: 'credit', label: 'دائن' },
    { value: 'zero', label: 'صفري' },
  ];

  protected readonly sortOptions: SortOption[] = [
    { key: 'balance', label: 'الرصيد' },
    { key: 'name', label: 'الاسم' },
    { key: 'totalDebit', label: 'إجمالي المدين' },
    { key: 'totalCredit', label: 'إجمالي الدائن' },
    { key: 'lastMovementAt', label: 'آخر حركة' },
  ];

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: PartyBalanceRow }>>('nameCell');
  private readonly debitCell = viewChild.required<TemplateRef<{ $implicit: PartyBalanceRow }>>('debitCell');
  private readonly creditCell = viewChild.required<TemplateRef<{ $implicit: PartyBalanceRow }>>('creditCell');
  private readonly balanceCell = viewChild.required<TemplateRef<{ $implicit: PartyBalanceRow }>>('balanceCell');
  private readonly limitCell = viewChild.required<TemplateRef<{ $implicit: PartyBalanceRow }>>('limitCell');
  private readonly lastCell = viewChild.required<TemplateRef<{ $implicit: PartyBalanceRow }>>('lastCell');

  protected readonly columns = computed<TableColumn<PartyBalanceRow>[]>(() => [
    { key: 'name', label: 'الحساب', sortable: true, cellTemplate: this.nameCell() },
    { key: 'totalDebit', label: 'إجمالي المدين', sortable: true, align: 'end', cellTemplate: this.debitCell() },
    { key: 'totalCredit', label: 'إجمالي الدائن', sortable: true, align: 'end', cellTemplate: this.creditCell() },
    { key: 'balance', label: 'الرصيد', sortable: true, align: 'end', cellTemplate: this.balanceCell() },
    { key: 'creditLimit', label: 'حد الائتمان', width: '170px', cellTemplate: this.limitCell() },
    { key: 'lastMovementAt', label: 'آخر حركة', sortable: true, align: 'center', cellTemplate: this.lastCell() },
  ]);

  protected readonly exporting = signal(false);
  protected readonly kindView = PARTY_KIND_VIEW;
  protected readonly money = formatMoney;
  protected readonly day = formatDayMonth;
  protected readonly tone = balanceTone;
  protected readonly sideLabel = (b: number) => BALANCE_SIDE_LABEL[balanceSide(b)];
  protected readonly abs = Math.abs;

  protected usage(row: PartyBalanceRow): number {
    return row.creditLimit > 0 ? Math.max(0, Math.round((row.balance / row.creditLimit) * 100)) : 0;
  }

  protected setAsOf(value: string): void {
    this.state.setParam('asOf', value && value !== this.today ? value : null, true);
  }

  protected toggle(key: 'overLimit' | 'hideZero'): void {
    this.state.setFilter(key, this.state.query().filters[key] ? null : '1');
  }

  protected refresh(): void {
    this.list.reload();
    this.summary.reload();
  }

  protected export(): void {
    const query = this.state.query();
    const asOf = this.asOf() || null;
    this.exporting.set(true);
    fetchAllPages((pageIndex, pageSize) => this.parties.balances({ ...query, pageIndex, pageSize }, asOf), 100)
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((rows) => {
        downloadCsv(`balances-${asOf ?? this.today}`, rows, [
          { label: 'الكود', value: (r) => r.code },
          { label: 'الاسم', value: (r) => r.name },
          { label: 'النوع', value: (r) => PARTY_KIND_VIEW[r.kind].label },
          { label: 'إجمالي المدين', value: (r) => r.totalDebit },
          { label: 'إجمالي الدائن', value: (r) => r.totalCredit },
          { label: 'الرصيد', value: (r) => Math.abs(r.balance) },
          { label: 'طبيعة الرصيد', value: (r) => BALANCE_SIDE_LABEL[balanceSide(r.balance)] },
          { label: 'حد الائتمان', value: (r) => r.creditLimit },
          { label: 'آخر حركة', value: (r) => r.lastMovementAt ?? '' },
        ]);
        this.toast.success(`تم تصدير ${formatInteger(rows.length)} حساب`);
      });
  }
}
