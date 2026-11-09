import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ListQuery } from '../../../../core/models/list-query.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { fetchAllPages } from '../../../../core/utils/api-list.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { FilterOption, FilterSelectComponent } from '../../../../shared/components/filter-select/filter-select.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { StatusTab, StatusTabsComponent } from '../../../../shared/components/status-tabs/status-tabs.component';
import { SummaryTile, SummaryTilesComponent } from '../../../../shared/components/summary-tiles/summary-tiles.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { downloadCsv } from '../../../../shared/utils/csv.util';
import { formatInteger, formatMoney, formatMoneyCompact, formatRelative } from '../../../../shared/utils/format.util';
import { PartyCardComponent } from '../../components/party-card/party-card.component';
import { BALANCE_SIDE_LABEL, balanceSide, Party, PARTY_KIND_VIEW, PRICE_LIST_LABEL } from '../../models/party.model';
import { PartiesService } from '../../services/parties.service';
import { balanceTone, formatBalance } from '../../utils/party-display.util';

/** Customers & suppliers directory — kind tabs, filters, totals, all in the URL. */
@Component({
  selector: 'app-party-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AvatarComponent,
    DataTableComponent,
    FilterSelectComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    PartyCardComponent,
    RowTemplateDirective,
    StatusPillComponent,
    StatusTabsComponent,
    SummaryTilesComponent,
  ],
  templateUrl: './party-list.page.html',
  styleUrl: './party-list.page.scss',
})
export class PartyListPage {
  private readonly parties = inject(PartiesService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'code', dir: 'asc' },
    filters: ['kind', 'status', 'balance', 'external'],
  });
  protected readonly list = createListResource(this.state.query, (q) => this.parties.list(q));

  /** Totals for the same search + kind / balance filters (status-independent). */
  private readonly summaryQuery = computed<ListQuery>(
    () => {
      const { search, filters } = this.state.query();
      const f: Record<string, string> = {};
      if (filters['kind']) f['kind'] = filters['kind'];
      if (filters['balance']) f['side'] = filters['balance'];
      return { pageIndex: 1, pageSize: 1, search, sort: null, filters: f };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly summary = createQueryResource(this.summaryQuery, (q) => this.parties.balancesSummary(q, null));

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const s = this.summary.value();
    const loading = this.list.initialLoading();
    return [
      { label: 'عدد الحسابات', icon: 'users', value: loading ? null : this.list.count(), format: formatInteger },
      { label: 'مستحق للمتجر (مدين)', icon: 'cash-in', value: s?.receivable ?? null, format: formatMoneyCompact, tone: 'var(--bl)' },
      { label: 'مستحق على المتجر (دائن)', icon: 'cash-out', value: s?.payable ?? null, format: formatMoneyCompact, tone: 'var(--am)' },
      { label: 'تجاوزوا حد الائتمان', icon: 'alert', value: s?.overLimitCount ?? null, format: formatInteger, tone: 'var(--re)' },
    ];
  });

  protected readonly kindTabs: StatusTab[] = [
    { value: null, label: 'الكل', color: 'var(--primary)', count: null },
    { value: 'customer', label: 'العملاء', color: PARTY_KIND_VIEW.customer.color, count: null },
    { value: 'supplier', label: 'الموردون', color: PARTY_KIND_VIEW.supplier.color, count: null },
    { value: 'both', label: 'عميل ومورد', color: PARTY_KIND_VIEW.both.color, count: null },
  ];

  protected readonly statusOptions: FilterOption[] = [
    { value: 'active', label: 'نشط' },
    { value: 'inactive', label: 'موقوف' },
  ];
  protected readonly balanceOptions: FilterOption[] = [
    { value: 'debit', label: 'رصيد مدين' },
    { value: 'credit', label: 'رصيد دائن' },
    { value: 'zero', label: 'رصيد صفري' },
  ];
  protected readonly externalOptions: FilterOption[] = [
    { value: '1', label: 'عملاء خارجيون (نقطة البيع)' },
    { value: '0', label: 'حسابات مسجلة' },
  ];

  protected readonly sortOptions: SortOption[] = [
    { key: 'code', label: 'الكود' },
    { key: 'name', label: 'الاسم' },
    { key: 'balance', label: 'الرصيد' },
    { key: 'createdAt', label: 'تاريخ التسجيل' },
  ];

  private readonly codeCell = viewChild.required<TemplateRef<{ $implicit: Party }>>('codeCell');
  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: Party }>>('nameCell');
  private readonly kindCell = viewChild.required<TemplateRef<{ $implicit: Party }>>('kindCell');
  private readonly balanceCell = viewChild.required<TemplateRef<{ $implicit: Party }>>('balanceCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: Party }>>('statusCell');

  protected readonly columns = computed<TableColumn<Party>[]>(() => [
    { key: 'code', label: 'الكود', sortable: true, width: '110px', cellTemplate: this.codeCell() },
    { key: 'name', label: 'الاسم', sortable: true, cellTemplate: this.nameCell() },
    { key: 'kind', label: 'النوع', align: 'center', cellTemplate: this.kindCell() },
    { key: 'city', label: 'المدينة' },
    { key: 'balance', label: 'الرصيد', sortable: true, align: 'end', cellTemplate: this.balanceCell() },
    { key: 'isActive', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
  ]);

  protected readonly exporting = signal(false);
  protected readonly kindView = PARTY_KIND_VIEW;
  protected readonly balanceText = formatBalance;
  protected readonly tone = balanceTone;
  protected readonly relative = formatRelative;

  protected edit(p: Party): void {
    this.router.navigate(['/customers/card'], { queryParams: { id: p.id } });
  }

  protected statement(p: Party): void {
    this.router.navigate(['/customers/statement'], { queryParams: { partyId: p.id } });
  }

  protected refresh(): void {
    this.list.reload();
    this.summary.reload();
  }

  protected async remove(p: Party): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'حذف الحساب',
      message: `سيتم حذف «${p.name}» نهائيًا. الحسابات التي عليها حركات لا تُحذف — يمكن إيقافها. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.parties.delete(p.id).subscribe(() => {
      this.toast.success('تم حذف الحساب');
      this.refresh();
    });
  }

  protected export(): void {
    const query = this.state.query();
    this.exporting.set(true);
    fetchAllPages((pageIndex, pageSize) => this.parties.list({ ...query, pageIndex, pageSize }), 100)
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((rows) => {
        downloadCsv(`parties-${new Date().toISOString().slice(0, 10)}`, rows, [
          { label: 'الكود', value: (p) => p.code },
          { label: 'الاسم', value: (p) => p.name },
          { label: 'النوع', value: (p) => PARTY_KIND_VIEW[p.kind].label },
          { label: 'الموبايل', value: (p) => p.phone },
          { label: 'المدينة', value: (p) => p.city },
          { label: 'قائمة الأسعار', value: (p) => PRICE_LIST_LABEL[p.priceList] },
          { label: 'حد الائتمان', value: (p) => p.creditLimit },
          { label: 'الرصيد', value: (p) => Math.abs(p.balance) },
          { label: 'طبيعة الرصيد', value: (p) => BALANCE_SIDE_LABEL[balanceSide(p.balance)] },
          { label: 'الحالة', value: (p) => (p.isActive ? 'نشط' : 'موقوف') },
        ]);
        this.toast.success(`تم تصدير ${formatInteger(rows.length)} حساب`);
      });
  }

  protected readonly money = formatMoney;
}
