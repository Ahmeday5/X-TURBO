import { ChangeDetectionStrategy, Component, computed, inject, input, TemplateRef, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/list/list-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { formatMoney } from '../../../../shared/utils/format.util';
import { ItemCardComponent } from '../../components/item-card/item-card.component';
import { StockMeterComponent } from '../../components/stock-meter/stock-meter.component';
import { Item, ITEM_ERROR_CODES, marginPct, toItemPayload } from '../../models/item.model';
import { ApiError } from '../../../../core/models/api-response.model';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ItemGroupsService } from '../../services/item-groups.service';
import { ItemsService } from '../../services/items.service';

/** Item catalogue: search, filter, sort, page — all mirrored to the URL. */
@Component({
  selector: 'app-items-directory',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    PaginationComponent,
    IconComponent,
    ItemCardComponent,
    StockMeterComponent,
  ],
  templateUrl: './items-directory.page.html',
  styleUrl: './items-directory.page.scss',
})
export class ItemsDirectoryPage {
  private readonly items = inject(ItemsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'code', dir: 'desc' },
    filters: ['groupId', 'status', 'stock'],
  });
  protected readonly list = createListResource(this.state.query, (q) => this.items.list(q));
  protected readonly groups = toSignal(inject(ItemGroupsService).lookup(), { initialValue: [] });

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: Item }>>('nameCell');
  private readonly priceCell = viewChild.required<TemplateRef<{ $implicit: Item }>>('priceCell');
  private readonly stockCell = viewChild.required<TemplateRef<{ $implicit: Item }>>('stockCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: Item }>>('statusCell');
  private readonly codeCell = viewChild.required<TemplateRef<{ $implicit: Item }>>('codeCell');

  protected readonly sortOptions: SortOption[] = [
    { key: 'code', label: 'الكود' },
    { key: 'name', label: 'الاسم' },
    { key: 'salePrice', label: 'سعر البيع' },
    { key: 'stock', label: 'الرصيد' },
  ];

  /** Computed from the view-child signals, so cell templates resolve after view init. */
  protected readonly columns = computed<TableColumn<Item>[]>(() => [
    { key: 'code', label: 'الكود', sortable: true, width: '120px', cellTemplate: this.codeCell() },
    { key: 'name', label: 'الصنف', sortable: true, cellTemplate: this.nameCell() },
    { key: 'unit', label: 'الوحدة', width: '90px' },
    { key: 'salePrice', label: 'السعر', sortable: true, align: 'end', cellTemplate: this.priceCell() },
    { key: 'stock', label: 'الرصيد', sortable: true, align: 'center', cellTemplate: this.stockCell() },
    { key: 'isActive', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
  ]);

  protected readonly money = formatMoney;
  protected readonly margin = marginPct;

  protected edit(item: Item): void {
    this.router.navigate(['/items/define'], { queryParams: { id: item.id } });
  }

  protected async remove(item: Item): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'حذف الصنف',
      message: `سيتم حذف «${item.name}» نهائيًا. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.items.delete(item.id).subscribe({
      next: () => {
        this.toast.success('تم حذف الصنف');
        this.list.reload();
      },
      error: (err: ApiError) => {
        if (hasErrorCode(err, ITEM_ERROR_CODES.hasMovements)) void this.offerDeactivate(item, err.message);
        else this.toast.error(err.message);
      },
    });
  }

  /**
   * An item with stock movements can never be deleted (even at zero stock) —
   * the API's answer is to deactivate it, which hides it from new documents
   * while keeping its history intact.
   */
  private async offerDeactivate(item: Item, serverMessage: string): Promise<void> {
    if (!item.isActive) {
      this.toast.error(serverMessage || 'لا يمكن حذف صنف عليه حركات، وهو موقوف بالفعل');
      return;
    }
    const deactivate = await this.dialog.confirm({
      title: 'لا يمكن حذف الصنف',
      message: `${serverMessage || `«${item.name}» عليه حركات مخزنية ولا يمكن حذفه.`}\nهل تريد إيقافه بدلًا من ذلك؟ لن يظهر في المستندات الجديدة وسيبقى تاريخه كما هو.`,
      confirmText: 'إيقاف الصنف',
      type: 'warning',
    });
    if (!deactivate) return;
    this.items.update(item.id, toItemPayload(item, { isActive: false })).subscribe(() => {
      this.toast.success(`تم إيقاف «${item.name}»`);
      this.list.reload();
    });
  }
}
