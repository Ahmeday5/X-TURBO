import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { NavigationService } from '../../../../core/services/navigation.service';
import { ToastService } from '../../../../core/services/toast.service';
import { fetchAllPages } from '../../../../core/utils/api-list.util';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { DateRange, DateRangeComponent } from '../../../../shared/components/date-range/date-range.component';
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
import { formatDayMonth, formatInteger, formatMoney, formatMoneyCompact } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { PrintStylesComponent } from '../../../parties/components/print-styles/print-styles.component';
import { VoucherDrawerComponent } from '../../components/voucher-drawer/voucher-drawer.component';
import { VoucherEditorComponent } from '../../components/voucher-editor/voucher-editor.component';
import { VoucherPrintComponent } from '../../components/voucher-print/voucher-print.component';
import {
  Voucher,
  VOUCHER_KIND_CONFIG,
  VOUCHER_METHOD_LABEL,
  VOUCHER_METHODS,
  VOUCHER_STATUS_VIEW,
  VOUCHER_STATUSES,
  VoucherKind,
  VoucherSummary,
} from '../../models/voucher.model';
import { VouchersService } from '../../services/vouchers.service';
import { injectVoucherLookups } from '../../utils/voucher-lookups';
import {
  counterpartyName,
  JOURNAL_LINES_PLURAL,
  newVoucherLabel,
  VOUCHER_KIND_ICON,
  voucherKindForRoute,
  VOUCHERS_PLURAL,
} from '../../utils/voucher-view';
import { todayIsoDate } from '../../../../shared/utils/date-iso.util';

const FILTERS = ['status', 'from', 'to', 'method', 'cashAccountId', 'partyId', 'costCenterId'] as const;

/**
 * One screen for the three voucher kinds (journal / receipt / payment). The
 * kind comes from the nav route; everything kind-specific is read from
 * VOUCHER_KIND_CONFIG.
 *
 * URL: list state + `?voucher=new|<id>` (full-page editor) + `?view=<id>` (drawer).
 */
@Component({
  selector: 'app-vouchers-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    DateRangeComponent,
    FilterSelectComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    PrintStylesComponent,
    RowTemplateDirective,
    StatusPillComponent,
    StatusTabsComponent,
    SummaryTilesComponent,
    VoucherDrawerComponent,
    VoucherEditorComponent,
    VoucherPrintComponent,
  ],
  templateUrl: './vouchers.page.html',
  styleUrl: './vouchers.page.scss',
})
export class VouchersPage {
  private readonly vouchers = inject(VouchersService);
  private readonly toast = inject(ToastService);
  private readonly nav = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly kind = computed<VoucherKind>(() => voucherKindForRoute(this.nav.leaf(this.navId())?.route ?? '') ?? 'journal');
  protected readonly cfg = computed(() => VOUCHER_KIND_CONFIG[this.kind()]);
  protected readonly icon = computed(() => VOUCHER_KIND_ICON[this.kind()]);
  protected readonly isJournal = computed(() => this.kind() === 'journal');
  protected readonly newLabel = computed(() => newVoucherLabel(this.kind()));

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'date', dir: 'desc' },
    filters: FILTERS,
  });

  protected readonly list = createListResource(this.state.query, (q) => this.vouchers.list(this.kind(), q));
  /** Stats ignore paging / sort (and the server ignores status), so tabs keep their counts. */
  private readonly statsQuery = computed(
    () => ({ kind: this.kind(), query: { ...this.state.query(), pageIndex: 1, sort: null } }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly stats = createQueryResource(this.statsQuery, ({ kind, query }) => this.vouchers.stats(kind, query));

  /** `new` | voucher id → editor replaces the list. */
  protected readonly editing = this.state.param('voucher');
  protected readonly viewing = this.state.param('view');
  protected readonly exporting = signal(false);
  /** Voucher being printed (rendered `.print-only`). */
  protected readonly printing = signal<Voucher | null>(null);

  // ── Filter options ──

  private readonly lookups = injectVoucherLookups();
  protected readonly methodOptions: FilterOption[] = VOUCHER_METHODS.map((m) => ({ value: m, label: VOUCHER_METHOD_LABEL[m] }));
  protected readonly cashOptions = computed<FilterOption[]>(() => this.lookups.cashAccounts().map((a) => ({ value: a.id, label: a.name })));
  protected readonly partyOptions = computed<FilterOption[]>(() => this.lookups.parties().map((p) => ({ value: p.id, label: p.name })));
  protected readonly centerOptions = computed<FilterOption[]>(() => this.lookups.centers().map((c) => ({ value: c.id, label: c.name })));

  protected readonly tabs = computed<StatusTab[]>(() => {
    const s = this.stats.value();
    return [
      { value: null, label: 'الكل', color: 'var(--primary)', count: s?.count ?? null },
      ...VOUCHER_STATUSES.map((status) => {
        const view = VOUCHER_STATUS_VIEW[status];
        return { value: status, label: view.label, color: view.color, count: s ? s[status] : null };
      }),
    ];
  });

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const s = this.stats.value();
    const cfg = this.cfg();
    const tone = cfg.direction === 'in' ? 'var(--gr)' : cfg.direction === 'out' ? 'var(--re)' : 'var(--bl)';
    return [
      { label: cfg.title, icon: this.icon(), value: s?.count ?? null, format: formatInteger, hint: s ? `${pluralAr(s.posted, VOUCHERS_PLURAL)} مُرحّل` : undefined },
      {
        label: cfg.direction === 'in' ? 'إجمالي المقبوضات' : cfg.direction === 'out' ? 'إجمالي المصروفات' : 'إجمالي القيود',
        icon: 'wallet',
        value: s?.total ?? null,
        format: formatMoneyCompact,
        tone,
        hint: 'بدون الملغي',
      },
      { label: 'هذا الشهر', icon: 'calendar', value: s?.thisMonth ?? null, format: formatMoneyCompact, tone: 'var(--bl)' },
      { label: 'مسودات بانتظار الترحيل', icon: 'clock', value: s?.draft ?? null, format: formatInteger, tone: 'var(--am)' },
    ];
  });

  protected readonly sortOptions = computed<SortOption[]>(() => [
    { key: 'date', label: 'التاريخ' },
    { key: 'createdAt', label: 'الأحدث إنشاءً' },
    { key: 'amount', label: 'المبلغ' },
    ...(this.isJournal() ? [] : [{ key: 'partyName', label: 'الجهة' }]),
    { key: 'number', label: 'الرقم' },
  ]);

  // ── Table ──

  private readonly numberCell = viewChild.required<TemplateRef<{ $implicit: VoucherSummary }>>('numberCell');
  private readonly partyCell = viewChild.required<TemplateRef<{ $implicit: VoucherSummary }>>('partyCell');
  private readonly cashCell = viewChild.required<TemplateRef<{ $implicit: VoucherSummary }>>('cashCell');
  private readonly descCell = viewChild.required<TemplateRef<{ $implicit: VoucherSummary }>>('descCell');
  private readonly linesCell = viewChild.required<TemplateRef<{ $implicit: VoucherSummary }>>('linesCell');
  private readonly amountCell = viewChild.required<TemplateRef<{ $implicit: VoucherSummary }>>('amountCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: VoucherSummary }>>('statusCell');

  protected readonly columns = computed<TableColumn<VoucherSummary>[]>(() => {
    const cfg = this.cfg();
    const cols: TableColumn<VoucherSummary>[] = [
      { key: 'number', label: 'السند', sortable: true, width: '150px', cellTemplate: this.numberCell() },
    ];
    if (this.isJournal()) {
      cols.push({ key: 'description', label: 'البيان', cellTemplate: this.descCell() });
      cols.push({ key: 'linesCount', label: 'الأسطر', align: 'center', cellTemplate: this.linesCell() });
    } else {
      cols.push({ key: 'partyName', label: cfg.partyLabel, sortable: true, cellTemplate: this.partyCell() });
      cols.push({ key: 'cashAccountName', label: cfg.direction === 'in' ? 'إلى خزينة' : 'من خزينة', cellTemplate: this.cashCell() });
    }
    cols.push({ key: 'amount', label: 'المبلغ', sortable: true, align: 'end', cellTemplate: this.amountCell() });
    cols.push({ key: 'status', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() });
    return cols;
  });

  protected readonly statusView = VOUCHER_STATUS_VIEW;
  protected readonly methodLabel = VOUCHER_METHOD_LABEL;
  protected readonly counterparty = counterpartyName;
  protected readonly money = formatMoney;
  protected readonly day = (iso: string) => formatDayMonth(iso.slice(0, 10));
  protected readonly linesLabel = (n: number) => pluralAr(n, JOURNAL_LINES_PLURAL);

  // ── Navigation ──

  protected openNew(): void {
    this.patch({ voucher: 'new', view: null });
  }

  protected open(v: { id: string }): void {
    this.state.setParam('view', v.id);
  }

  protected edit(id: string): void {
    this.patch({ voucher: id, view: null });
  }

  protected closeEditor(): void {
    this.patch({ voucher: null });
  }

  protected onSaved(v: Voucher): void {
    this.patch({ voucher: null, view: v.id });
    this.refresh();
  }

  protected onLocked(id: string): void {
    this.patch({ voucher: null, view: id });
  }

  protected setRange(range: DateRange): void {
    this.patch({ from: range.from, to: range.to, page: null });
  }

  protected refresh(): void {
    this.list.reload();
    this.stats.reload();
  }

  protected print(v: Voucher): void {
    this.printing.set(v);
    setTimeout(() => window.print());
  }

  /** Several params in one navigation (separate calls would overwrite each other). */
  private patch(params: Record<string, string | null>): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge' });
  }

  // ── Export ──

  protected export(): void {
    const query = this.state.query();
    const kind = this.kind();
    const cfg = this.cfg();
    this.exporting.set(true);
    fetchAllPages((pageIndex, pageSize) => this.vouchers.list(kind, { ...query, pageIndex, pageSize }), 100)
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((rows) => {
        downloadCsv(`${cfg.prefix.toLowerCase()}-${todayIsoDate()}`, rows, [
          { label: 'الرقم', value: (v) => v.number },
          { label: 'التاريخ', value: (v) => v.date },
          ...(kind === 'journal'
            ? [
                { label: 'عدد الأسطر', value: (v: VoucherSummary) => v.linesCount },
                { label: 'إجمالي المدين', value: (v: VoucherSummary) => v.totalDebit },
                { label: 'إجمالي الدائن', value: (v: VoucherSummary) => v.totalCredit },
              ]
            : [
                { label: cfg.partyLabel, value: (v: VoucherSummary) => counterpartyName(v) },
                { label: cfg.direction === 'in' ? 'إلى خزينة' : 'من خزينة', value: (v: VoucherSummary) => v.cashAccountName ?? '' },
                { label: 'الطريقة', value: (v: VoucherSummary) => (v.method ? VOUCHER_METHOD_LABEL[v.method] : '') },
                { label: 'مركز التكلفة', value: (v: VoucherSummary) => v.costCenterName ?? '' },
                { label: 'المبلغ', value: (v: VoucherSummary) => v.amount },
              ]),
          { label: 'البيان', value: (v) => v.description },
          { label: 'المرجع', value: (v) => v.reference },
          { label: 'الحالة', value: (v) => VOUCHER_STATUS_VIEW[v.status].label },
          { label: 'أنشأه', value: (v) => v.createdBy },
        ]);
        this.toast.success(`تم تصدير ${pluralAr(rows.length, VOUCHERS_PLURAL)}`);
      });
  }
}
