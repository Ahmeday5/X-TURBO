import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, TemplateRef, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_ERROR_CODES, hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { ListQuery } from '../../../../core/models/list-query.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { apiErrorToMessage } from '../../../../core/utils/api-error.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { DetailsDrawerComponent } from '../../../../shared/components/details-drawer/details-drawer.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { StatusTab, StatusTabsComponent } from '../../../../shared/components/status-tabs/status-tabs.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { formatDateTime, formatInteger, formatRelative, formatShortDate } from '../../../../shared/utils/format.util';
import { telHref, toLocalMobile } from '../../../../shared/utils/phone.util';
import { AppCustomerActionsComponent } from '../../components/app-customer-actions/app-customer-actions.component';
import {
  ACTION_TARGET,
  APP_CUSTOMER_ERROR_CODES,
  APP_CUSTOMER_STATUS_VIEW,
  APP_CUSTOMER_STATUSES,
  AppCustomer,
  AppCustomerAction,
  appCustomerActions,
  AppCustomerStatus,
  appCustomerStatusView,
  mapsUrl,
} from '../../models/app-customer.model';
import { AppCustomerStatsService } from '../../services/app-customer-stats.service';
import { AppCustomersService } from '../../services/app-customers.service';
import { toAppCustomerDetails } from '../../utils/app-customer-details';

/** `?status=` value of the "الكل" tab. No `status` in the URL = the default tab (see `defaultTab`). */
const ALL = 'all';
type Tab = typeof ALL | AppCustomerStatus;

const isTab = (v: string | undefined): v is Tab => v === ALL || APP_CUSTOMER_STATUSES.includes(v as AppCustomerStatus);

const EMPTY_TITLE: Record<Tab, string> = {
  all: 'لا يوجد عملاء مطابقون',
  pending: 'لا توجد تسجيلات بانتظار المراجعة',
  active: 'لا يوجد عملاء مفعّلون مطابقون',
  blocked: 'لا يوجد عملاء محظورون',
};

/**
 * Mobile-app customers: approve new sign-ups, block / unblock. Status tabs
 * with live counts (default "قيد المراجعة" while there are sign-ups waiting,
 * otherwise "الكل"), search, sort, paging, an "include unverified" switch and
 * a details drawer. Filters and the open drawer (`?customer=<id>`) live in the URL.
 */
@Component({
  selector: 'app-app-customers-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AppCustomerActionsComponent,
    AvatarComponent,
    DataTableComponent,
    DetailsDrawerComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    RowTemplateDirective,
    StatusPillComponent,
    StatusTabsComponent,
  ],
  templateUrl: './app-customers.page.html',
  styleUrl: './app-customers.page.scss',
})
export class AppCustomersPage {
  private readonly api = inject(AppCustomersService);
  protected readonly counters = inject(AppCustomerStatsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 20,
    defaultSort: { key: 'createdAt', dir: 'desc' },
    filters: ['status', 'includeUnverified'],
  });

  /**
   * Tab used when the URL names none: "قيد المراجعة" if sign-ups are waiting,
   * otherwise "الكل". Resolved once from the counters, then kept — the list
   * must not jump tabs when the last pending customer gets activated.
   */
  private readonly defaultTab = signal<Tab | null>(null);
  protected readonly activeTab = computed<Tab | null>(() => {
    const fromUrl = this.state.query().filters['status'];
    return isTab(fromUrl) ? fromUrl : this.defaultTab();
  });

  /** What the API gets: the URL query with the resolved tab (`all` = no status). `null` until a tab is known. */
  private readonly apiQuery = computed<ListQuery | null>(
    () => {
      const tab = this.activeTab();
      if (!tab) return null;
      const q = this.state.query();
      const { status: _status, ...rest } = q.filters;
      return { ...q, filters: tab === ALL ? rest : { ...rest, status: tab } };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly list = createListResource(this.apiQuery, (q) => this.api.list(q));
  protected readonly waitingForTab = computed(() => !this.apiQuery());

  protected readonly includeUnverified = computed(() => this.state.query().filters['includeUnverified'] === 'true');

  // ── Details drawer — fetched by id (`?customer=<id>`) so it shows the server's current state ──
  protected readonly viewId = this.state.param('customer');
  protected readonly viewed = createQueryResource(this.viewId, (id) => this.api.get(id), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل بيانات العميل',
  });
  protected readonly viewedCustomer = computed(() => {
    const c = this.viewed.value();
    return c && c.id === this.viewId() ? c : null;
  });
  protected readonly details = computed(() => {
    const c = this.viewedCustomer();
    return c ? toAppCustomerDetails(c) : null;
  });

  /** Customer whose status change is in flight (one at a time per row). */
  protected readonly busy = signal<{ id: string; action: AppCustomerAction } | null>(null);

  protected readonly statusView = appCustomerStatusView;
  protected readonly phone = toLocalMobile;
  protected readonly tel = telHref;
  protected readonly relative = formatRelative;
  protected readonly dateTime = formatDateTime;
  protected readonly shortDate = formatShortDate;
  protected readonly int = formatInteger;
  protected readonly maps = mapsUrl;

  protected readonly tabs = computed<StatusTab[]>(() => {
    const s = this.counters.stats();
    const v = APP_CUSTOMER_STATUS_VIEW;
    return [
      { value: ALL, label: 'الكل', color: 'var(--primary)', count: s?.total ?? null },
      { value: 'pending', label: v.pending.label, color: v.pending.color, count: s?.pending ?? null },
      { value: 'active', label: v.active.label, color: v.active.color, count: s?.active ?? null },
      { value: 'blocked', label: v.blocked.label, color: v.blocked.color, count: s?.blocked ?? null },
    ];
  });

  protected readonly emptyTitle = computed(() => EMPTY_TITLE[this.activeTab() ?? ALL]);

  protected readonly sortOptions: SortOption[] = [
    { key: 'createdAt', label: 'تاريخ التسجيل' },
    { key: 'name', label: 'الاسم' },
    { key: 'phone', label: 'الموبايل' },
    { key: 'governorate', label: 'المحافظة' },
    { key: 'status', label: 'الحالة' },
    { key: 'lastLoginAt', label: 'آخر دخول' },
    { key: 'statusChangedAt', label: 'آخر تغيير للحالة' },
  ];

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: AppCustomer }>>('nameCell');
  private readonly phoneCell = viewChild.required<TemplateRef<{ $implicit: AppCustomer }>>('phoneCell');
  private readonly governorateCell = viewChild.required<TemplateRef<{ $implicit: AppCustomer }>>('governorateCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: AppCustomer }>>('statusCell');
  private readonly ordersCell = viewChild.required<TemplateRef<{ $implicit: AppCustomer }>>('ordersCell');
  private readonly createdCell = viewChild.required<TemplateRef<{ $implicit: AppCustomer }>>('createdCell');
  private readonly loginCell = viewChild.required<TemplateRef<{ $implicit: AppCustomer }>>('loginCell');

  protected readonly columns = computed<TableColumn<AppCustomer>[]>(() => [
    { key: 'name', label: 'الاسم', sortable: true, cellTemplate: this.nameCell() },
    { key: 'phone', label: 'الموبايل', sortable: true, cellTemplate: this.phoneCell() },
    { key: 'governorate', label: 'المحافظة', sortable: true, cellTemplate: this.governorateCell() },
    { key: 'status', label: 'الحالة', sortable: true, align: 'center', cellTemplate: this.statusCell() },
    { key: 'ordersCount', label: 'الطلبات', align: 'center', cellTemplate: this.ordersCell() },
    { key: 'createdAt', label: 'تاريخ التسجيل', sortable: true, cellTemplate: this.createdCell() },
    { key: 'lastLoginAt', label: 'آخر دخول', sortable: true, cellTemplate: this.loginCell() },
  ]);

  constructor() {
    // Fresh counters (tabs + sidebar badge) every time the screen opens.
    this.counters.refresh();

    effect(
      () => {
        if (this.defaultTab()) return;
        const stats = this.counters.stats();
        const failed = this.counters.failed();
        if (!stats && !failed) return;
        untracked(() => this.defaultTab.set(stats && stats.pending > 0 ? 'pending' : ALL));
      },
      { allowSignalWrites: true },
    );
  }

  // ── Navigation ──

  protected setTab(tab: string | null): void {
    this.state.setFilter('status', tab ?? ALL);
  }

  protected setIncludeUnverified(on: boolean): void {
    this.state.setFilter('includeUnverified', on ? 'true' : null);
  }

  protected open(c: Pick<AppCustomer, 'id'>): void {
    this.state.setParam('customer', c.id);
  }

  protected closeDrawer(): void {
    this.state.setParam('customer', null);
  }

  protected refresh(): void {
    this.list.reload();
    this.counters.refresh();
    if (this.viewId()) this.viewed.reload();
  }

  // ── Status changes ──

  protected async run(c: AppCustomer, action: AppCustomerAction): Promise<void> {
    if (this.busy()) return;
    const allowed = appCustomerActions(c).find((a) => a.key === action);
    if (!allowed) return;
    if (allowed.disabledReason) {
      this.toast.warning(`لا يمكن تفعيل ${c.name}: ${allowed.disabledReason}`);
      return;
    }
    if (action === 'block') {
      const confirmed = await this.dialog.confirm({
        title: 'حظر العميل',
        message: `سيتم تسجيل خروج «${c.name}» من التطبيق فورًا ولن يستطيع الدخول مرة أخرى حتى يُفك الحظر. هل أنت متأكد؟`,
        confirmText: 'حظر',
        type: 'danger',
      });
      if (!confirmed) return;
    }

    this.busy.set({ id: c.id, action });
    this.api.setStatus(c.id, ACTION_TARGET[action]).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.toast.success(successMessage(action, updated.name || c.name));
        this.refresh();
      },
      error: (err: ApiError) => {
        this.busy.set(null);
        this.handleStatusError(c, err);
      },
    });
  }

  private handleStatusError(c: AppCustomer, err: ApiError): void {
    if (hasErrorCode(err, APP_CUSTOMER_ERROR_CODES.phoneNotVerified)) {
      this.toast.warning(err.message || `لا يمكن تفعيل ${c.name} — لم يؤكد رقم موبايله بكود الـ SMS بعد.`);
      this.refresh();
      return;
    }
    if (hasErrorCode(err, API_ERROR_CODES.notFound) || err.status === 404) {
      this.toast.error(`العميل ${c.name} لم يعد موجودًا.`);
      if (this.viewId() === c.id) this.closeDrawer();
      this.refresh();
      return;
    }
    if (hasErrorCode(err, API_ERROR_CODES.forbidden) || err.status === 403) {
      this.toast.error(err.message || 'ليس لديك صلاحية تغيير حالة العملاء.');
      return;
    }
    this.toast.error(apiErrorToMessage(err, 'تعذّر تغيير حالة العميل — حاول مرة أخرى.'));
  }
}

function successMessage(action: AppCustomerAction, name: string): string {
  switch (action) {
    case 'activate':
      return `تم تفعيل حساب ${name} — يمكنه الآن الدخول إلى التطبيق`;
    case 'block':
      return `تم حظر ${name} وتسجيل خروجه من التطبيق`;
    case 'unblock':
      return `تم فك حظر ${name} — يمكنه الدخول إلى التطبيق مرة أخرى`;
  }
}
