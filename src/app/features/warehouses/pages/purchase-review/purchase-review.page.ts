import { ChangeDetectionStrategy, Component, computed, inject, input, TemplateRef, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { PagedResponse } from '../../../../core/models/api-response.model';
import { ListQuery } from '../../../../core/models/list-query.model';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { RowMenuComponent } from '../../../../shared/components/row-menu/row-menu.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { StatusTab, StatusTabsComponent } from '../../../../shared/components/status-tabs/status-tabs.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { formatDayMonth, formatInteger, formatMoney, formatRelative } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { DocumentDrawerComponent } from '../../../documents/components/document-drawer/document-drawer.component';
import { DOC_KIND_CONFIG, DocumentSummary } from '../../../documents/models/document.model';
import { DocAction, documentActions } from '../../../documents/utils/document-actions';
import { LINES_PLURAL, PAYMENT_STATE_VIEW, paymentState } from '../../../documents/utils/document-view';
import { WarehousesService } from '../../services/warehouses.service';

const PURCHASE = DOC_KIND_CONFIG.purchase;

const EMPTY_PAGE: PagedResponse<DocumentSummary> = { pageIndex: 1, pageSize: 0, count: 0, totalPages: 0, data: [] };

/**
 * Warehouse manager's review queue: purchase invoices of one warehouse still
 * `pending-review` (`GET warehouses/:id/purchase-invoices`). Activating one
 * receives the goods (stock + ledger); cancelling drops it without effect —
 * either way it leaves this list.
 *
 * The decision itself runs in the shared document drawer, so its confirm
 * dialogs, lifecycle rules and error handling are the ones every document
 * screen uses. Viewing / acting needs `Invoices.View` on top of the page's
 * `Warehouses.View`; without it the queue is read-only.
 *
 * URL: list state + `?warehouseId=` (defaults to the default warehouse)
 *      + `?view=<id>` (drawer) + `?do=<action>` (row action run by the drawer).
 */
@Component({
  selector: 'app-purchase-review-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    DocumentDrawerComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    RouterLink,
    RowMenuComponent,
    RowTemplateDirective,
    StatusPillComponent,
    StatusTabsComponent,
  ],
  templateUrl: './purchase-review.page.html',
  styleUrl: './purchase-review.page.scss',
})
export class PurchaseReviewPage {
  private readonly api = inject(WarehousesService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  /** Viewing a document and activating / cancelling it go through the documents API. */
  protected readonly canReview = computed(() => this.auth.hasPermission(PERMISSIONS.invoices));

  protected readonly state = new UrlListState({
    pageSize: 12,
    // Oldest first: the queue is worked in arrival order.
    defaultSort: { key: 'createdAt', dir: 'asc' },
    filters: ['warehouseId'],
  });

  // ── Warehouse scope ──

  protected readonly warehouses = toSignal(this.api.lookup(), { initialValue: null });

  /** Warehouse from the URL, else the default one once the lookup arrives. */
  protected readonly warehouseId = computed<string | null>(() => {
    const fromUrl = this.state.query().filters['warehouseId'];
    if (fromUrl) return fromUrl;
    const list = this.warehouses();
    return (list?.find((w) => w.isDefault) ?? list?.[0])?.id ?? null;
  });

  protected readonly warehouseName = computed(
    () => this.warehouses()?.find((w) => w.id === this.warehouseId())?.name ?? '',
  );

  protected readonly warehouseTabs = computed<StatusTab[]>(() =>
    (this.warehouses() ?? []).map((w) => ({ value: w.id, label: w.name, color: 'var(--am)', count: null })),
  );

  // ── Queue ──

  /** The list query with the resolved warehouse — refetches when either changes. */
  private readonly reviewQuery = computed<ListQuery>(
    () => {
      const q = this.state.query();
      return { ...q, filters: { warehouseId: this.warehouseId() ?? '' } };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  protected readonly list = createListResource(this.reviewQuery, (q) => {
    const id = q.filters['warehouseId'];
    return id ? this.api.purchaseInvoicesForReview(id, q) : of(EMPTY_PAGE);
  });

  /** Lookup still loading — the queue can't be requested yet. */
  protected readonly resolving = computed(() => this.warehouses() === null);
  protected readonly noWarehouses = computed(() => this.warehouses()?.length === 0);

  protected readonly sortOptions: SortOption[] = [
    { key: 'createdAt', label: 'الأقدم وصولًا' },
    { key: 'date', label: 'تاريخ الفاتورة' },
    { key: 'total', label: 'القيمة' },
    { key: 'partyName', label: 'المورد' },
    { key: 'number', label: 'الرقم' },
  ];

  // ── Drawer ──

  protected readonly viewing = this.state.param('view');
  private readonly doParam = this.state.param('do');
  /** Row action waiting for the drawer to run it. */
  protected readonly intent = computed(() => (this.doParam() as DocAction) || null);

  // ── Table ──

  private readonly numberCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('numberCell');
  private readonly supplierCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('supplierCell');
  private readonly qtyCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('qtyCell');
  private readonly totalCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('totalCell');
  private readonly createdCell = viewChild.required<TemplateRef<{ $implicit: DocumentSummary }>>('createdCell');

  protected readonly columns = computed<TableColumn<DocumentSummary>[]>(() => [
    { key: 'number', label: 'الفاتورة', sortable: true, width: '150px', cellTemplate: this.numberCell() },
    { key: 'partyName', label: 'المورد', sortable: true, cellTemplate: this.supplierCell() },
    { key: 'totalQty', label: 'الأصناف', align: 'center', cellTemplate: this.qtyCell() },
    { key: 'total', label: 'الصافي', sortable: true, align: 'end', cellTemplate: this.totalCell() },
    { key: 'createdAt', label: 'أُنشئت', sortable: true, align: 'center', cellTemplate: this.createdCell() },
  ]);

  protected readonly actionsOf = (d: DocumentSummary) => documentActions(d, d.linesCount > 0);
  protected readonly paymentView = (d: DocumentSummary) => PAYMENT_STATE_VIEW[paymentState(d)];
  protected readonly money = formatMoney;
  protected readonly int = formatInteger;
  protected readonly relative = formatRelative;
  protected readonly day = (iso: string) => formatDayMonth(iso.slice(0, 10));
  protected readonly linesLabel = (n: number) => pluralAr(n, LINES_PLURAL);
  protected readonly purchasesRoute = PURCHASE.route;

  protected readonly emptyText = computed(() =>
    this.state.query().search
      ? 'لا توجد فاتورة مطابقة للبحث بين الفواتير المعلّقة.'
      : `كل فواتير الشراء في «${this.warehouseName()}» تمت مراجعتها — لا شيء بانتظارك.`,
  );

  // ── Actions ──

  protected selectWarehouse(id: string | null): void {
    // Changing scope closes any open document (it belongs to the previous queue).
    this.state.setParams({ warehouseId: id, view: null, do: null }, true);
  }

  protected open(d: DocumentSummary): void {
    if (this.canReview()) this.state.setParam('view', d.id);
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

  /** Editing happens in the purchases screen's full-page editor. */
  protected edit(id: string): void {
    void this.router.navigate([PURCHASE.route], { queryParams: { doc: id } });
  }

  protected closeDrawer(): void {
    this.state.setParams({ view: null, do: null });
  }

  protected reload(): void {
    this.list.reload();
  }
}
