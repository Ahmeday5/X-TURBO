import { ChangeDetectionStrategy, Component, computed, inject, input, TemplateRef, viewChild } from '@angular/core';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { FilterSelectComponent, toFilterOptions } from '../../../../shared/components/filter-select/filter-select.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { formatMoney, formatRelative } from '../../../../shared/utils/format.util';
import { PartRequestDrawerComponent } from '../../components/part-request-drawer/part-request-drawer.component';
import {
  PART_REQUEST_STATUS_VIEW,
  PART_REQUEST_STATUSES,
  PartRequest,
  PartRequestAction,
  partRequestActions,
  PartRequestStatus,
} from '../../models/part-request.model';
import { RowMenuComponent } from '../../../../shared/components/row-menu/row-menu.component';
import { PartRequestsService } from '../../services/part-requests.service';

const PART_REQUEST_FILTERS = ['status'] as const;

/** Quick status chips above the table — the states that need someone to act. */
const QUICK_STATUSES: readonly PartRequestStatus[] = ['pending_review', 'accepted', 'quoted'];

/** Part requests by photo: status filter, search, sort, paging, details drawer — all in the URL. */
@Component({
  selector: 'app-part-requests-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    DataTableComponent,
    FilterSelectComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    PartRequestDrawerComponent,
    RowMenuComponent,
    RowTemplateDirective,
    StatusPillComponent,
  ],
  templateUrl: './part-requests.page.html',
  styleUrl: './part-requests.page.scss',
})
export class PartRequestsPage {
  private readonly service = inject(PartRequestsService);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'createdAt', dir: 'desc' },
    filters: PART_REQUEST_FILTERS,
  });
  protected readonly list = createListResource(this.state.query, (q) => this.service.list(q));

  /** Open drawer, mirrored to `?request=` so a refresh or shared link reopens it. */
  protected readonly openId = this.state.param('request');
  protected readonly activeStatus = computed(
    () => (this.state.query().filters['status'] as PartRequestStatus | undefined) ?? null,
  );

  protected readonly statusOptions = toFilterOptions(PART_REQUEST_STATUSES, (s) => PART_REQUEST_STATUS_VIEW[s].label);
  protected readonly quickStatuses = QUICK_STATUSES;
  protected readonly statusView = PART_REQUEST_STATUS_VIEW;

  protected readonly sortOptions: SortOption[] = [
    { key: 'createdAt', label: 'تاريخ الطلب' },
    { key: 'customerName', label: 'العميل' },
    { key: 'partName', label: 'القطعة' },
  ];

  private readonly numberCell = viewChild.required<TemplateRef<{ $implicit: PartRequest }>>('numberCell');
  private readonly customerCell = viewChild.required<TemplateRef<{ $implicit: PartRequest }>>('customerCell');
  private readonly partCell = viewChild.required<TemplateRef<{ $implicit: PartRequest }>>('partCell');
  private readonly quoteCell = viewChild.required<TemplateRef<{ $implicit: PartRequest }>>('quoteCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: PartRequest }>>('statusCell');

  protected readonly columns = computed<TableColumn<PartRequest>[]>(() => [
    { key: 'createdAt', label: 'الطلب', sortable: true, width: '150px', cellTemplate: this.numberCell() },
    { key: 'customerName', label: 'العميل', sortable: true, cellTemplate: this.customerCell() },
    { key: 'partName', label: 'القطعة', sortable: true, cellTemplate: this.partCell() },
    { key: 'quotedPrice', label: 'العرض', align: 'end', cellTemplate: this.quoteCell() },
    { key: 'status', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
  ]);

  protected readonly money = formatMoney;
  protected readonly relative = formatRelative;

  /** Row action requested from the table — run by the drawer (one implementation). */
  private readonly doParam = this.state.param('do');
  protected readonly intent = computed(() => (this.doParam() as PartRequestAction) || null);
  protected readonly actionsOf = partRequestActions;

  protected open(request: PartRequest): void {
    this.state.setParam('request', request.id);
  }

  protected act(request: PartRequest, action: PartRequestAction): void {
    this.state.setParams({ request: request.id, do: action });
  }

  protected closeDrawer(): void {
    this.state.setParams({ request: null, do: null });
  }

  protected setStatus(status: string | null): void {
    this.state.setFilter('status', status);
  }

  protected toggleQuick(status: PartRequestStatus): void {
    this.setStatus(this.activeStatus() === status ? null : status);
  }
}
