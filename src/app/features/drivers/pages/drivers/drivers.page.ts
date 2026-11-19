import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { DetailsDrawerComponent } from '../../../../shared/components/details-drawer/details-drawer.component';
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
import { formatDateTime, formatInteger, formatRelative } from '../../../../shared/utils/format.util';
import { telHref, toLocalMobile } from '../../../../shared/utils/phone.util';
import { DriverFormDrawerComponent } from '../../components/driver-form-drawer/driver-form-drawer.component';
import { DriverPasswordModalComponent } from '../../components/driver-password-modal/driver-password-modal.component';
import { Driver, DRIVER_ERROR_CODES, DRIVER_STATUS_VIEW, driverStatus, NO_DRIVER } from '../../models/driver.model';
import { DeliveryStatsService } from '../../services/delivery-stats.service';
import { DriversService } from '../../services/drivers.service';
import { toDriverDetails } from '../../utils/driver-details';

/**
 * Delivery drivers: counters, status tabs, search / sort, table or cards, a
 * details drawer and — with Users.Manage — create / edit / suspend / reset
 * password / delete. Filters and the open form (`?driver=new|<id>`) live in the URL.
 */
@Component({
  selector: 'app-drivers-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AvatarComponent,
    DataTableComponent,
    DetailsDrawerComponent,
    DriverFormDrawerComponent,
    DriverPasswordModalComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    RowTemplateDirective,
    StatusPillComponent,
    StatusTabsComponent,
    SummaryTilesComponent,
  ],
  templateUrl: './drivers.page.html',
  styleUrl: './drivers.page.scss',
})
export class DriversPage {
  private readonly drivers = inject(DriversService);
  protected readonly delivery = inject(DeliveryStatsService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  protected readonly canManage = computed(() => this.auth.hasPermission(PERMISSIONS.users));
  /** Orders / problems screens need Orders.View — links to them hide without it. */
  protected readonly canSeeOrders = computed(() => this.auth.hasPermission(PERMISSIONS.orders));

  protected readonly state = new UrlListState({
    pageSize: 10,
    defaultSort: { key: 'name', dir: 'asc' },
    filters: ['status'],
  });
  protected readonly list = createListResource(this.state.query, (q) => this.drivers.list(q));
  /** `new` or a driver id while the form drawer is open. */
  protected readonly editing = this.state.param('driver');

  protected readonly stats = this.delivery.stats;

  // ── Details drawer (👁) — fetched by id so it shows the server's current numbers ──
  protected readonly viewId = signal<string | null>(null);
  protected readonly viewed = createQueryResource(this.viewId, (id) => this.drivers.get(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل بيانات المندوب',
  });
  protected readonly details = computed(() => {
    const d = this.viewed.value();
    return d && d.id === this.viewId() ? toDriverDetails(d) : null;
  });

  protected readonly resetting = signal<Driver | null>(null);
  protected readonly busyId = signal<string | null>(null);

  protected readonly statusView = DRIVER_STATUS_VIEW;
  protected readonly statusOf = driverStatus;
  protected readonly phone = toLocalMobile;
  protected readonly tel = telHref;
  protected readonly relative = formatRelative;
  protected readonly dateTime = formatDateTime;
  protected readonly int = formatInteger;

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const s = this.stats();
    const orders = this.canSeeOrders();
    const problems = s?.openProblems ?? 0;
    return [
      {
        label: 'المناديب النشطون',
        icon: 'user-check',
        value: s?.active ?? null,
        format: formatInteger,
        tone: 'var(--gr)',
        hint: s ? `من ${formatInteger(s.total)} مندوب` : undefined,
      },
      {
        label: 'طلبات في الطريق',
        icon: 'truck',
        value: s?.ordersOutForDelivery ?? null,
        format: formatInteger,
        tone: 'var(--pu)',
        link: orders ? { route: '/orders', queryParams: { status: 'shipped' }, label: 'عرض الطلبات التي في الطريق' } : undefined,
      },
      {
        label: 'مؤكدة بدون مندوب',
        icon: 'clock',
        value: s?.unassignedConfirmedOrders ?? null,
        format: formatInteger,
        tone: 'var(--am)',
        hint: s?.unassignedConfirmedOrders ? 'بانتظار تعيين مندوب' : undefined,
        link: orders
          ? {
              route: '/orders',
              queryParams: { status: 'processing', driverId: NO_DRIVER, channel: 'online' },
              label: 'عرض الطلبات المؤكدة التي لم يُعيَّن لها مندوب',
            }
          : undefined,
      },
      {
        label: 'بلاغات مفتوحة',
        icon: 'alert',
        value: s?.openProblems ?? null,
        format: formatInteger,
        tone: problems > 0 ? 'var(--re)' : 'var(--txt3)',
        hint: problems > 0 ? 'تحتاج ردًا' : undefined,
        link: orders ? { route: '/order-problems', label: 'عرض بلاغات التوصيل المفتوحة' } : undefined,
      },
    ];
  });

  protected readonly statusTabs = computed<StatusTab[]>(() => {
    const s = this.stats();
    return [
      { value: null, label: 'كل المناديب', color: 'var(--primary)', count: s?.total ?? null },
      { value: 'active', label: DRIVER_STATUS_VIEW.active.label, color: DRIVER_STATUS_VIEW.active.color, count: s?.active ?? null },
      { value: 'suspended', label: DRIVER_STATUS_VIEW.suspended.label, color: DRIVER_STATUS_VIEW.suspended.color, count: s?.suspended ?? null },
    ];
  });

  protected readonly sortOptions: SortOption[] = [
    { key: 'name', label: 'الاسم' },
    { key: 'phone', label: 'الموبايل' },
    { key: 'isActive', label: 'الحالة' },
    { key: 'lastLoginAt', label: 'آخر دخول' },
    { key: 'createdAt', label: 'تاريخ الإضافة' },
  ];

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: Driver }>>('nameCell');
  private readonly phoneCell = viewChild.required<TemplateRef<{ $implicit: Driver }>>('phoneCell');
  private readonly vehicleCell = viewChild.required<TemplateRef<{ $implicit: Driver }>>('vehicleCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: Driver }>>('statusCell');
  private readonly activeCell = viewChild.required<TemplateRef<{ $implicit: Driver }>>('activeCell');
  private readonly deliveredCell = viewChild.required<TemplateRef<{ $implicit: Driver }>>('deliveredCell');
  private readonly loginCell = viewChild.required<TemplateRef<{ $implicit: Driver }>>('loginCell');

  protected readonly columns = computed<TableColumn<Driver>[]>(() => [
    { key: 'name', label: 'المندوب', sortable: true, cellTemplate: this.nameCell() },
    { key: 'phone', label: 'الموبايل', sortable: true, cellTemplate: this.phoneCell() },
    { key: 'vehicleType', label: 'المركبة', cellTemplate: this.vehicleCell() },
    { key: 'isActive', label: 'الحالة', sortable: true, align: 'center', cellTemplate: this.statusCell() },
    { key: 'activeOrders', label: 'طلبات جارية', align: 'center', cellTemplate: this.activeCell() },
    { key: 'deliveredOrders', label: 'تم تسليمها', align: 'center', cellTemplate: this.deliveredCell() },
    { key: 'lastLoginAt', label: 'آخر دخول', sortable: true, cellTemplate: this.loginCell() },
  ]);

  // ── Navigation ──

  protected openCreate(): void {
    this.state.setParam('driver', 'new');
  }

  protected edit(d: Pick<Driver, 'id'>): void {
    this.state.setParam('driver', d.id);
  }

  protected closeForm(): void {
    this.state.setParam('driver', null);
  }

  protected onSaved(): void {
    this.closeForm();
    this.refresh();
  }

  protected refresh(): void {
    this.list.reload();
    this.delivery.refresh();
    if (this.viewId()) this.viewed.reload();
  }

  // ── Row actions ──

  protected async toggleActive(d: Driver): Promise<void> {
    if (d.isActive) {
      const load = d.activeOrders
        ? `\nمعه الآن ${formatInteger(d.activeOrders)} طلب جاري — حوّلها لمندوب آخر من شاشة الطلبات.`
        : '';
      const confirmed = await this.dialog.confirm({
        title: 'إيقاف المندوب',
        message: `سيتم تسجيل خروج «${d.name}» من التطبيق فورًا ولن يستطيع الدخول أو استلام إشعارات حتى يُعاد تفعيله.${load}`,
        confirmText: 'إيقاف',
        type: 'warning',
      });
      if (!confirmed) return;
    }
    this.setActive(d, !d.isActive);
  }

  protected async remove(d: Driver): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'حذف المندوب',
      message: `سيتم حذف حساب «${d.name}» نهائيًا. الحذف متاح فقط لمندوب بدون أي طلبات — للإيقاف المؤقت استخدم «إيقاف».`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.busyId.set(d.id);
    this.drivers.delete(d.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(`تم حذف المندوب ${d.name}`);
        if (this.viewId() === d.id) this.viewId.set(null);
        this.refresh();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (hasErrorCode(err, DRIVER_ERROR_CODES.hasOrders)) void this.offerSuspend(d, err);
        else this.toast.error(err.message);
      },
    });
  }

  /** Delete refused because of order history — suspending keeps the history and blocks the login. */
  private async offerSuspend(d: Driver, err: ApiError): Promise<void> {
    if (!d.isActive) {
      this.toast.warning(`${err.message || 'لا يمكن حذف مندوب له طلبات'} — الحساب موقوف بالفعل.`);
      return;
    }
    const suspend = await this.dialog.confirm({
      title: 'لا يمكن حذف المندوب',
      message: `${err.message || 'هذا المندوب له طلبات مسجلة، فلا يمكن حذفه.'}\nهل تريد إيقاف حسابه بدلًا من ذلك؟ سيتم تسجيل خروجه فورًا مع الاحتفاظ بسجل طلباته.`,
      confirmText: 'إيقاف الحساب',
      type: 'warning',
    });
    if (suspend) this.setActive(d, false);
  }

  private setActive(d: Driver, isActive: boolean): void {
    this.busyId.set(d.id);
    this.drivers.setActive(d.id, isActive).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(isActive ? `تم تفعيل ${d.name}` : `تم إيقاف ${d.name} وتسجيل خروجه من التطبيق`);
        this.refresh();
      },
      error: () => this.busyId.set(null),
    });
  }
}
