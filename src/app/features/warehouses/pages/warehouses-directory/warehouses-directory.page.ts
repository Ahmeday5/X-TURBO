import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { FilterSelectComponent, toFilterOptions } from '../../../../shared/components/filter-select/filter-select.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { SummaryTile, SummaryTilesComponent } from '../../../../shared/components/summary-tiles/summary-tiles.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { formatCompact, formatInteger, formatMoney, formatMoneyCompact } from '../../../../shared/utils/format.util';
import { WarehouseCardComponent } from '../../components/warehouse-card/warehouse-card.component';
import { usageTone, Warehouse, WarehousePayload, WAREHOUSE_TYPES, WAREHOUSE_TYPE_VIEW } from '../../models/warehouse.model';
import { WarehousesService } from '../../services/warehouses.service';

/** Every warehouse with capacity usage and stock figures; filters and view mirrored to the URL. */
@Component({
  selector: 'app-warehouses-directory',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    SummaryTilesComponent,
    ListToolbarComponent,
    FilterSelectComponent,
    DataTableComponent,
    PaginationComponent,
    IconComponent,
    StatusPillComponent,
    RowTemplateDirective,
    WarehouseCardComponent,
  ],
  templateUrl: './warehouses-directory.page.html',
  styleUrl: './warehouses-directory.page.scss',
})
export class WarehousesDirectoryPage {
  private readonly api = inject(WarehousesService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'code', dir: 'asc' },
    filters: ['type', 'status'],
    defaultView: 'cards',
  });
  protected readonly list = createListResource(this.state.query, (q) => this.api.list(q));

  /** Network-wide totals (the list is small, so one unfiltered page covers it). */
  protected readonly all = createQueryResource(signal(null), () =>
    this.api.list({ pageIndex: 1, pageSize: 100, search: '', sort: null, filters: {} }),
  );

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const rows = this.all.value()?.data ?? null;
    const sum = (f: (w: Warehouse) => number) => (rows ? rows.reduce((s, w) => s + f(w), 0) : null);
    const active = rows?.filter((w) => w.isActive).length;
    return [
      { label: 'المخازن', icon: 'warehouse', value: rows?.length ?? null, format: formatInteger, hint: rows ? `${active} نشط` : undefined },
      { label: 'إجمالي الكميات', icon: 'layers', value: sum((w) => w.totalQty), format: formatCompact, tone: 'var(--bl)' },
      { label: 'قيمة المخزون', icon: 'coins', value: sum((w) => w.stockValue), format: formatMoneyCompact, tone: 'var(--gr)' },
      { label: 'أصناف تحت حد الطلب', icon: 'alert', value: sum((w) => w.lowStockCount), format: formatInteger, tone: 'var(--am)' },
    ];
  });

  protected readonly typeOptions = toFilterOptions(WAREHOUSE_TYPES, (t) => WAREHOUSE_TYPE_VIEW[t].label);
  protected readonly statusOptions = [
    { value: 'active', label: 'نشط' },
    { value: 'inactive', label: 'موقوف' },
  ];
  protected readonly sortOptions: SortOption[] = [
    { key: 'code', label: 'الكود' },
    { key: 'name', label: 'الاسم' },
    { key: 'usagePct', label: 'نسبة الإشغال' },
    { key: 'stockValue', label: 'قيمة المخزون' },
    { key: 'lowStockCount', label: 'تحت حد الطلب' },
  ];

  private readonly codeCell = viewChild.required<TemplateRef<{ $implicit: Warehouse }>>('codeCell');
  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: Warehouse }>>('nameCell');
  private readonly typeCell = viewChild.required<TemplateRef<{ $implicit: Warehouse }>>('typeCell');
  private readonly usageCell = viewChild.required<TemplateRef<{ $implicit: Warehouse }>>('usageCell');
  private readonly valueCell = viewChild.required<TemplateRef<{ $implicit: Warehouse }>>('valueCell');
  private readonly lowCell = viewChild.required<TemplateRef<{ $implicit: Warehouse }>>('lowCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: Warehouse }>>('statusCell');

  protected readonly columns = computed<TableColumn<Warehouse>[]>(() => [
    { key: 'code', label: 'الكود', sortable: true, width: '100px', cellTemplate: this.codeCell() },
    { key: 'name', label: 'المخزن', sortable: true, cellTemplate: this.nameCell() },
    { key: 'type', label: 'النوع', align: 'center', cellTemplate: this.typeCell() },
    { key: 'usagePct', label: 'الإشغال', sortable: true, width: '160px', cellTemplate: this.usageCell() },
    { key: 'stockValue', label: 'قيمة المخزون', sortable: true, align: 'end', cellTemplate: this.valueCell() },
    { key: 'lowStockCount', label: 'تحت حد الطلب', sortable: true, align: 'center', cellTemplate: this.lowCell() },
    { key: 'isActive', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
  ]);

  protected readonly typeView = WAREHOUSE_TYPE_VIEW;
  protected readonly usageTone = usageTone;
  protected readonly money = formatMoney;
  protected readonly qty = formatInteger;

  protected edit(w: Warehouse): void {
    this.router.navigate(['/warehouses/define'], { queryParams: { id: w.id } });
  }

  protected openStock(w: Warehouse): void {
    this.router.navigate(['/stock'], { queryParams: { warehouseId: w.id } });
  }

  protected async makeDefault(w: Warehouse): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'تغيير المخزن الافتراضي',
      message: `سيصبح «${w.name}» المخزن المختار تلقائيًا في المستندات ونقطة البيع.`,
      confirmText: 'تعيين كافتراضي',
      type: 'info',
    });
    if (!confirmed) return;
    this.api.update(w.id, { ...this.payloadOf(w), isDefault: true, isActive: true }).subscribe(() => {
      this.toast.success(`أصبح «${w.name}» المخزن الافتراضي`);
      this.reload();
    });
  }

  protected async remove(w: Warehouse): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'حذف المخزن',
      message: `سيتم حذف «${w.name}» نهائيًا. لا يمكن حذف مخزن به أرصدة أو حركات.`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete(w.id).subscribe(() => {
      this.toast.success('تم حذف المخزن');
      this.reload();
    });
  }

  protected reload(): void {
    this.list.reload();
    this.all.reload();
  }

  private payloadOf(w: Warehouse): WarehousePayload {
    const { name, type, city, address, manager, phone, capacity, allowNegative, isDefault, isActive, notes } = w;
    return { name, type, city, address, manager, phone, capacity, allowNegative, isDefault, isActive, notes };
  }
}
