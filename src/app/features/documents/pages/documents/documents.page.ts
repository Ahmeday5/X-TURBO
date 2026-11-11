import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
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
import { formatDayMonth, formatInteger, formatMoney, formatMoneyCompact, formatRelative } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { PartiesService } from '../../../parties/services/parties.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { DocumentDrawerComponent } from '../../components/document-drawer/document-drawer.component';
import { DocumentEditorComponent } from '../../components/document-editor/document-editor.component';
import {
  DOC_KIND_CONFIG,
  DOC_PAYMENT_LABEL,
  DocKind,
  docKindForRoute,
  Document,
  DocumentSummary,
  docStatusCount,
  docStatusesFor,
  docStatusView,
  openStatusFor,
} from '../../models/document.model';
import { DocumentsService } from '../../services/documents.service';
import {
  DOCS_PLURAL,
  LINES_PLURAL,
  newLabel,
  PAYMENT_STATE_VIEW,
  partyLabel,
  paymentState,
  tracksPayment,
} from '../../utils/document-view';
import { todayIsoDate } from '../../../../shared/utils/date-iso.util';
import { RowMenuComponent } from '../../../../shared/components/row-menu/row-menu.component';
import { DocAction, documentActions } from '../../utils/document-actions';

const FILTERS = ['status', 'from', 'to', 'warehouseId', 'partyId', 'payment', 'channel', 'overdue'] as const;

/**
 * One screen for every document kind (invoices, returns, transfers, goods
 * issue / receipt, quotations, reservations). The kind comes from the nav
 * route; everything kind-specific is read from DOC_KIND_CONFIG.
 *
 * URL: list state + `?doc=new|<id>` (full-page editor) + `?view=<id>` (drawer).
 */
@Component({
  selector: 'app-documents-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    DateRangeComponent,
    DocumentDrawerComponent,
    DocumentEditorComponent,
    FilterSelectComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    RowMenuComponent,
    RowTemplateDirective,
    StatusPillComponent,
    StatusTabsComponent,
    SummaryTilesComponent,
  ],
  templateUrl: './documents.page.html',
  styleUrl: './documents.page.scss',
})
export class DocumentsPage {
  private readonly docs = inject(DocumentsService);
  private readonly toast = inject(ToastService);
  private readonly nav = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly kind = computed<DocKind>(() => docKindForRoute(this.nav.leaf(this.navId())?.route ?? '') ?? 'sale');
  protected readonly cfg = computed(() => DOC_KIND_CONFIG[this.kind()]);
  protected readonly financial = computed(() => this.cfg().financial);
  protected readonly withPayment = computed(() => tracksPayment(this.cfg()));
  protected readonly partyLabel = computed(() => partyLabel(this.cfg()));
  protected readonly newLabel = computed(() => newLabel(this.kind()));

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'createdAt', dir: 'desc' },
    filters: FILTERS,
  });

  private readonly listQuery = computed(() => ({ kind: this.kind(), query: this.state.query() }), {
    equal: (a, b) => a.kind === b.kind && JSON.stringify(a.query) === JSON.stringify(b.query),
  });
  protected readonly list = createListResource(this.state.query, (q) => this.docs.list(this.kind(), q));
  /** Stats ignore paging / sort (and the server ignores status), so tabs keep their counts. */
  private readonly statsQuery = computed(
    () => ({ ...this.listQuery().query, pageIndex: 1, sort: null }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly stats = createQueryResource(this.statsQuery, (q) => this.docs.stats(this.kind(), q));

  /** `new` | document id → editor replaces the list. */
  protected readonly editing = this.state.param('doc');
  protected readonly viewing = this.state.param('view');
  private readonly doParam = this.state.param('do');
  /** Row action waiting for the drawer to run it. */
  protected readonly intent = computed(() => (this.doParam() as DocAction) || null);
  protected readonly actionsOf = (d: DocumentSummary) => documentActions(d, d.linesCount > 0);
  protected readonly exporting = signal(false);

  // ── Filter options ──

  private readonly warehouses = toSignal(inject(WarehousesService).lookup(), { initialValue: [] });
  protected readonly warehouseOptions = computed<FilterOption[]>(() => this.warehouses().map((w) => ({ value: w.id, label: w.name })));

  private readonly parties = inject(PartiesService);
  private readonly partyList = toSignal(
    toObservable(this.cfg).pipe(switchMap((cfg) => (cfg.party ? this.parties.lookup(cfg.party) : of([])))),
    { initialValue: [] },
  );
  protected readonly partyOptions = computed<FilterOption[]>(() => this.partyList().map((p) => ({ value: p.id, label: p.name })));

  protected readonly paymentOptions: FilterOption[] = (['paid', 'partial', 'unpaid'] as const).map((p) => ({
    value: p,
    label: PAYMENT_STATE_VIEW[p].label,
  }));
  protected readonly channelOptions: FilterOption[] = [
    { value: 'erp', label: 'فواتير النظام' },
    { value: 'pos', label: 'نقطة البيع' },
  ];

  protected readonly tabs = computed<StatusTab[]>(() => {
    const s = this.stats.value();
    const kind = this.kind();
    return [
      { value: null, label: 'الكل', color: 'var(--primary)', count: s?.count ?? null },
      ...docStatusesFor(kind).map((status) => {
        const view = docStatusView(kind, status);
        return { value: status, label: view.label, color: view.color, count: s ? docStatusCount(s, status) : null };
      }),
    ];
  });

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const s = this.stats.value();
    const cfg = this.cfg();
    const v = <K extends keyof NonNullable<typeof s>>(k: K) => (s ? (s[k] as number) : null);
    const open = openStatusFor(cfg.kind);
    const count: SummaryTile = {
      label: cfg.title,
      icon: cfg.icon,
      value: v('count'),
      format: formatInteger,
      hint: s ? `${pluralAr(docStatusCount(s, open), DOCS_PLURAL)} ${open === 'pending-review' ? 'بانتظار المراجعة' : 'مسودة'}` : undefined,
    };

    if (tracksPayment(cfg)) {
      return [
        count,
        { label: 'إجمالي القيمة', icon: 'wallet', value: v('total'), format: formatMoneyCompact },
        { label: cfg.party === 'supplier' ? 'المسدد للموردين' : 'المحصّل', icon: 'cash-in', value: v('paid'), format: formatMoneyCompact, tone: 'var(--gr)' },
        { label: 'المتبقي (آجل)', icon: 'clock', value: v('remaining'), format: formatMoneyCompact, tone: 'var(--am)' },
      ];
    }
    if (cfg.kind === 'quotation') {
      return [
        count,
        { label: 'قيمة العروض', icon: 'wallet', value: v('total'), format: formatMoneyCompact },
        { label: 'معتمدة بانتظار العميل', icon: 'clock', value: v('posted'), format: formatInteger, tone: 'var(--bl)' },
        { label: 'تحولت لفواتير', icon: 'check', value: v('completed'), format: formatInteger, tone: 'var(--gr)' },
      ];
    }
    if (cfg.kind === 'reservation') {
      return [
        count,
        { label: 'قيمة الحجوزات', icon: 'wallet', value: v('total'), format: formatMoneyCompact },
        { label: 'محجوز حاليًا', icon: 'calendar', value: v('posted'), format: formatInteger, tone: 'var(--am)' },
        { label: 'العربون المحصّل', icon: 'cash-in', value: v('paid'), format: formatMoneyCompact, tone: 'var(--gr)' },
      ];
    }
    return [
      count,
      { label: 'إجمالي الكميات', icon: 'layers', value: v('totalQty'), format: formatInteger },
      { label: 'مُرحّلة', icon: 'check', value: v('posted') !== null ? (v('posted') ?? 0) + (v('completed') ?? 0) : null, format: formatInteger, tone: 'var(--gr)' },
      { label: 'القيمة بالتكلفة', icon: 'coins', value: v('total'), format: formatMoneyCompact, tone: 'var(--bl)' },
    ];
  });

  protected readonly sortOptions = computed<SortOption[]>(() => [
    { key: 'createdAt', label: 'الأحدث' },
    { key: 'date', label: 'التاريخ' },
    { key: 'total', label: 'القيمة' },
    ...(this.cfg().party ? [{ key: 'partyName', label: this.partyLabel() }] : []),
    { key: 'number', label: 'الرقم' },
  ]);

  // ── Table ──

  private readonly numberCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('numberCell');
  private readonly partyCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('partyCell');
  private readonly placeCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('placeCell');
  private readonly qtyCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('qtyCell');
  private readonly totalCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('totalCell');
  private readonly paymentCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('paymentCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('statusCell');

  protected readonly columns = computed<TableColumn<DocumentSummary>[]>(() => {
    const cfg = this.cfg();
    const cols: TableColumn<DocumentSummary>[] = [
      { key: 'number', label: 'المستند', sortable: true, width: '150px', cellTemplate: this.numberCell() },
    ];
    if (cfg.party) cols.push({ key: 'partyName', label: this.partyLabel(), sortable: true, cellTemplate: this.partyCell() });
    cols.push({ key: 'warehouseName', label: cfg.transfer ? 'التحويل' : 'المخزن', cellTemplate: this.placeCell() });
    cols.push({ key: 'totalQty', label: 'الأصناف', align: 'center', cellTemplate: this.qtyCell() });
    cols.push({ key: 'total', label: cfg.financial ? 'الصافي' : 'القيمة', sortable: true, align: 'end', cellTemplate: this.totalCell() });
    if (tracksPayment(cfg) || cfg.kind === 'reservation') {
      cols.push({ key: 'remaining', label: cfg.kind === 'reservation' ? 'العربون' : 'السداد', align: 'center', cellTemplate: this.paymentCell() });
    }
    cols.push({ key: 'status', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() });
    return cols;
  });

  protected readonly statusView = docStatusView;
  protected readonly paymentView = (d: DocumentSummary) => PAYMENT_STATE_VIEW[paymentState(d)];
  protected readonly paymentLabel = DOC_PAYMENT_LABEL;
  protected readonly money = formatMoney;
  protected readonly int = formatInteger;
  protected readonly relative = formatRelative;
  protected readonly day = (iso: string) => formatDayMonth(iso.slice(0, 10));
  protected readonly linesLabel = (n: number) => pluralAr(n, LINES_PLURAL);
  protected readonly overdue = (d: DocumentSummary) =>
    !!d.dueDate && d.status === 'posted' && d.remaining > 0 && d.dueDate < todayIsoDate();

  // ── Navigation ──

  protected openNew(): void {
    this.patch({ doc: 'new', view: null });
  }

  protected open(d: { id: string }): void {
    this.state.setParam('view', d.id);
  }

  /** Row action → the drawer runs it (its confirm dialogs, rules and errors — one implementation). */
  protected act(d: DocumentSummary, action: DocAction): void {
    // Pure navigations go straight there — no drawer round-trip.
    if (action === 'edit') return this.edit(d.id);
    if (action === 'labels') {
      void this.router.navigate(['/items/barcode-labels'], { queryParams: { doc: d.id } });
      return;
    }
    this.state.setParams({ view: d.id, do: action });
  }

  protected edit(id: string): void {
    this.patch({ doc: id, view: null });
  }

  protected closeEditor(): void {
    this.patch({ doc: null });
  }

  protected onSaved(doc: Document): void {
    this.patch({ doc: null, view: doc.id });
    this.refresh();
  }

  protected onLocked(id: string): void {
    this.patch({ doc: null, view: id });
  }

  protected setRange(range: DateRange): void {
    this.patch({ from: range.from, to: range.to, page: null });
  }

  protected refresh(): void {
    this.list.reload();
    this.stats.reload();
  }

  /** Several params in one navigation (separate calls would overwrite each other). */
  private patch(params: Record<string, string | null>): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: false });
  }

  // ── Export ──

  protected export(): void {
    const query = this.state.query();
    const kind = this.kind();
    const cfg = this.cfg();
    this.exporting.set(true);
    fetchAllPages((pageIndex, pageSize) => this.docs.list(kind, { ...query, pageIndex, pageSize }), 100)
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((rows) => {
        downloadCsv(`${cfg.prefix.toLowerCase()}-${todayIsoDate()}`, rows, [
          { label: 'الرقم', value: (d) => d.number },
          { label: 'التاريخ', value: (d) => d.date },
          ...(cfg.party ? [{ label: this.partyLabel(), value: (d: DocumentSummary) => d.partyName ?? 'عميل نقدي' }] : []),
          { label: cfg.transfer ? 'من مخزن' : 'المخزن', value: (d) => d.warehouseName },
          ...(cfg.transfer ? [{ label: 'إلى مخزن', value: (d: DocumentSummary) => d.toWarehouseName ?? '' }] : []),
          { label: 'عدد الأصناف', value: (d) => d.linesCount },
          { label: 'الكمية', value: (d) => d.totalQty },
          ...(cfg.financial
            ? [
                { label: 'الإجمالي', value: (d: DocumentSummary) => d.subtotal },
                { label: 'الخصم', value: (d: DocumentSummary) => d.discount },
                { label: 'الضريبة', value: (d: DocumentSummary) => d.tax },
              ]
            : []),
          { label: cfg.financial ? 'الصافي' : 'القيمة', value: (d) => d.total },
          ...(cfg.financial && cfg.stock !== 'none'
            ? [
                { label: 'المدفوع', value: (d: DocumentSummary) => d.paid },
                { label: 'المتبقي', value: (d: DocumentSummary) => d.remaining },
              ]
            : []),
          { label: 'المرجع', value: (d) => d.reference },
          { label: 'الحالة', value: (d) => docStatusView(d.kind, d.status).label },
          { label: 'أنشأه', value: (d) => d.createdBy },
        ]);
        this.toast.success(`تم تصدير ${pluralAr(rows.length, DOCS_PLURAL)}`);
      });
  }
}
