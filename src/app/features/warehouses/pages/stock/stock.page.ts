import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { fetchAllPages } from '../../../../core/utils/api-list.util';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { FilterSelectComponent, toFilterOptions } from '../../../../shared/components/filter-select/filter-select.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatusTab, StatusTabsComponent } from '../../../../shared/components/status-tabs/status-tabs.component';
import { SummaryTile, SummaryTilesComponent } from '../../../../shared/components/summary-tiles/summary-tiles.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { downloadCsv } from '../../../../shared/utils/csv.util';
import { formatCompact, formatInteger, formatMoney, formatMoneyCompact, formatRelative } from '../../../../shared/utils/format.util';
import { todayIsoDate } from '../../../../shared/utils/date-iso.util';
import { StockMeterComponent } from '../../../items/components/stock-meter/stock-meter.component';
import { STOCK_LEVEL_LABEL, StockLevel } from '../../../items/models/item.model';
import { ItemGroupsService } from '../../../items/services/item-groups.service';
import { ItemStockDrawerComponent } from '../../components/item-stock-drawer/item-stock-drawer.component';
import { StockRow } from '../../models/stock.model';
import { StockService } from '../../services/stock.service';
import { WarehousesService } from '../../services/warehouses.service';

const LEVELS: readonly StockLevel[] = ['ok', 'low', 'out'];

/**
 * Balances of every item in every warehouse: warehouse tabs, group / level
 * filters, totals for the current filters, and a per-item drawer
 * (`?item=`) with the split across warehouses and recent movements.
 */
@Component({
  selector: 'app-stock-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    SummaryTilesComponent,
    StatusTabsComponent,
    ListToolbarComponent,
    FilterSelectComponent,
    DataTableComponent,
    PaginationComponent,
    IconComponent,
    StockMeterComponent,
    RowTemplateDirective,
    ItemStockDrawerComponent,
  ],
  templateUrl: './stock.page.html',
  styleUrl: './stock.page.scss',
})
export class StockPage {
  private readonly stock = inject(StockService);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 20,
    defaultSort: { key: 'itemCode', dir: 'asc' },
    filters: ['warehouseId', 'groupId', 'level', 'reserved'],
  });
  protected readonly list = createListResource(this.state.query, (q) => this.stock.list(q));
  protected readonly summary = createQueryResource(this.state.query, (q) => this.stock.summary(q));

  protected readonly warehouses = toSignal(inject(WarehousesService).lookup(), { initialValue: [] });
  protected readonly groups = toSignal(inject(ItemGroupsService).lookup(), { initialValue: [] });

  /** Item whose drawer is open — in the URL so a refresh reopens it. */
  protected readonly openItem = this.state.param('item');
  protected readonly exporting = signal(false);

  protected readonly warehouseTabs = computed<StatusTab[]>(() => [
    { value: null, label: 'كل المخازن', color: 'var(--primary)', count: null },
    ...this.warehouses().map((w) => ({ value: w.id, label: w.name, color: 'var(--bl)', count: null })),
  ]);

  protected readonly groupOptions = computed(() => this.groups().map((g) => ({ value: g.id, label: g.name })));
  protected readonly levelOptions = toFilterOptions(LEVELS, (l) => STOCK_LEVEL_LABEL[l]);
  protected readonly reservedOptions = [{ value: '1', label: 'عليها حجوزات' }];

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const s = this.summary.value();
    return [
      { label: 'أصناف لها رصيد', icon: 'box', value: s?.skuCount ?? null, format: formatInteger },
      { label: 'إجمالي الكميات', icon: 'layers', value: s?.totalQty ?? null, format: formatCompact, tone: 'var(--bl)' },
      { label: 'قيمة المخزون بالتكلفة', icon: 'coins', value: s?.totalValue ?? null, format: formatMoneyCompact, tone: 'var(--gr)' },
      {
        label: 'تحت حد الطلب',
        icon: 'alert',
        value: s ? s.lowCount + s.outCount : null,
        format: formatInteger,
        tone: 'var(--am)',
        hint: s ? `منها ${formatInteger(s.outCount)} نفد رصيدها` : undefined,
      },
    ];
  });

  protected readonly sortOptions: SortOption[] = [
    { key: 'itemCode', label: 'كود الصنف' },
    { key: 'itemName', label: 'اسم الصنف' },
    { key: 'qty', label: 'الكمية' },
    { key: 'value', label: 'القيمة' },
    { key: 'lastMovementAt', label: 'آخر حركة' },
  ];

  private readonly itemCell = viewChild.required<TemplateRef<{ $implicit: StockRow }>>('itemCell');
  private readonly qtyCell = viewChild.required<TemplateRef<{ $implicit: StockRow }>>('qtyCell');
  private readonly availCell = viewChild.required<TemplateRef<{ $implicit: StockRow }>>('availCell');
  private readonly valueCell = viewChild.required<TemplateRef<{ $implicit: StockRow }>>('valueCell');
  private readonly moveCell = viewChild.required<TemplateRef<{ $implicit: StockRow }>>('moveCell');

  /** The warehouse column is redundant once a warehouse tab is picked. */
  protected readonly columns = computed<TableColumn<StockRow>[]>(() => [
    { key: 'itemName', label: 'الصنف', sortable: true, cellTemplate: this.itemCell() },
    ...(this.state.query().filters['warehouseId'] ? [] : [{ key: 'warehouseName', label: 'المخزن' }]),
    { key: 'qty', label: 'الرصيد', sortable: true, align: 'center', width: '110px', cellTemplate: this.qtyCell() },
    { key: 'available', label: 'المتاح', sortable: true, align: 'center', cellTemplate: this.availCell() },
    { key: 'value', label: 'القيمة', sortable: true, align: 'end', cellTemplate: this.valueCell() },
    { key: 'lastMovementAt', label: 'آخر حركة', sortable: true, align: 'center', cellTemplate: this.moveCell() },
  ]);

  protected readonly money = formatMoney;
  protected readonly qty = formatInteger;
  protected readonly relative = formatRelative;

  protected open(row: StockRow): void {
    this.state.setParam('item', row.itemId);
  }

  protected closeDrawer(): void {
    this.state.setParam('item', null);
  }

  protected reload(): void {
    this.list.reload();
    this.summary.reload();
  }

  protected export(): void {
    const query = this.state.query();
    this.exporting.set(true);
    fetchAllPages((pageIndex, pageSize) => this.stock.list({ ...query, pageIndex, pageSize }), 100)
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((rows) =>
        downloadCsv(`stock-${todayIsoDate()}`, rows, [
          { label: 'كود الصنف', value: (r) => r.itemCode },
          { label: 'الصنف', value: (r) => r.itemName },
          { label: 'المجموعة', value: (r) => r.groupName },
          { label: 'المخزن', value: (r) => r.warehouseName },
          { label: 'الوحدة', value: (r) => r.unit },
          { label: 'الرصيد', value: (r) => r.qty },
          { label: 'محجوز', value: (r) => r.reserved },
          { label: 'متاح', value: (r) => r.available },
          { label: 'حد الطلب', value: (r) => r.minStock },
          { label: 'تكلفة الوحدة', value: (r) => r.cost },
          { label: 'القيمة', value: (r) => r.value },
          { label: 'الحالة', value: (r) => STOCK_LEVEL_LABEL[r.level] },
        ]),
      );
  }
}
