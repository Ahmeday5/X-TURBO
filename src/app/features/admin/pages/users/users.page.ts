import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { Role, ROLES } from '../../../../core/auth/roles';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
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
import { formatDateTime, formatInteger, formatRelative } from '../../../../shared/utils/format.util';
import { ResetPasswordModalComponent } from '../../components/reset-password-modal/reset-password-modal.component';
import { RolesOverviewComponent } from '../../components/roles-overview/roles-overview.component';
import { UserFormDrawerComponent } from '../../components/user-form-drawer/user-form-drawer.component';
import { AdminUser, ROLE_VIEW, USER_ROLES, USER_STATUS_VIEW } from '../../models/user.model';
import { UsersService } from '../../services/users.service';

type UsersTab = 'users' | 'roles';

/**
 * Users & permissions: a users directory (role tabs, status filter, search)
 * with a create / edit drawer, plus a roles overview. Tab, filters and the
 * open drawer (`?user=new|<id>`) all live in the URL.
 */
@Component({
  selector: 'app-users-page',
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
    ResetPasswordModalComponent,
    RolesOverviewComponent,
    RowTemplateDirective,
    StatusPillComponent,
    StatusTabsComponent,
    SummaryTilesComponent,
    UserFormDrawerComponent,
  ],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
})
export class UsersPage {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 10,
    defaultSort: { key: 'name', dir: 'asc' },
    filters: ['role', 'status'],
  });
  private readonly tabParam = this.state.param('tab', 'users');
  protected readonly tab = computed<UsersTab>(() => (this.tabParam() === 'roles' ? 'roles' : 'users'));
  /** `new` or a user id while the drawer is open. */
  protected readonly editing = this.state.param('user');

  protected readonly list = createListResource(this.state.query, (q) => this.users.list(q));

  /** Counts for the current search (the roles tab shows global counts). */
  private readonly statsSearch = computed(() => (this.tab() === 'roles' ? '' : this.state.query().search));
  protected readonly stats = createQueryResource(this.statsSearch, (s) => this.users.stats(s));

  protected readonly selfId = computed(() => this.auth.currentUser()?.id ?? null);
  protected readonly activeAdmins = computed(() => this.stats.value()?.activeAdmins ?? 0);

  protected readonly resetting = signal<AdminUser | null>(null);
  protected readonly busyId = signal<string | null>(null);

  protected readonly roleView = ROLE_VIEW;
  protected readonly statusView = USER_STATUS_VIEW;
  protected readonly relative = formatRelative;
  protected readonly dateTime = formatDateTime;

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const s = this.stats.value();
    return [
      { label: 'إجمالي المستخدمين', icon: 'users', value: s?.total ?? null, format: formatInteger },
      { label: 'نشط', icon: 'check', value: s?.active ?? null, format: formatInteger, tone: 'var(--gr)' },
      { label: 'موقوف', icon: 'lock', value: s?.suspended ?? null, format: formatInteger, tone: 'var(--re)' },
      {
        label: 'مديرو النظام النشطون',
        icon: 'shield',
        value: s?.activeAdmins ?? null,
        format: formatInteger,
        tone: 'var(--primary)',
        hint: s && s.activeAdmins <= 1 ? 'آخر مدير محمي من الحذف والإيقاف' : undefined,
      },
    ];
  });

  protected readonly roleTabs = computed<StatusTab[]>(() => {
    const s = this.stats.value();
    return [
      { value: null, label: 'كل الأدوار', color: 'var(--primary)', count: s?.total ?? null },
      ...USER_ROLES.map((r) => ({
        value: r,
        label: ROLE_VIEW[r].label,
        color: ROLE_VIEW[r].color,
        count: s ? (s.byRole[r] ?? 0) : null,
      })),
    ];
  });

  protected readonly statusOptions: FilterOption[] = [
    { value: 'active', label: 'نشط' },
    { value: 'suspended', label: 'موقوف' },
  ];

  protected readonly sortOptions: SortOption[] = [
    { key: 'name', label: 'الاسم' },
    { key: 'lastLoginAt', label: 'آخر دخول' },
    { key: 'createdAt', label: 'تاريخ الإنشاء' },
  ];

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: AdminUser }>>('nameCell');
  private readonly roleCell = viewChild.required<TemplateRef<{ $implicit: AdminUser }>>('roleCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: AdminUser }>>('statusCell');
  private readonly loginCell = viewChild.required<TemplateRef<{ $implicit: AdminUser }>>('loginCell');
  private readonly permsCell = viewChild.required<TemplateRef<{ $implicit: AdminUser }>>('permsCell');

  protected readonly columns = computed<TableColumn<AdminUser>[]>(() => [
    { key: 'name', label: 'المستخدم', sortable: true, cellTemplate: this.nameCell() },
    { key: 'role', label: 'الدور', cellTemplate: this.roleCell() },
    { key: 'permissions', label: 'الصلاحيات', align: 'center', cellTemplate: this.permsCell() },
    { key: 'isActive', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
    { key: 'lastLoginAt', label: 'آخر دخول', sortable: true, cellTemplate: this.loginCell() },
  ]);

  // ── Guard rails (mirrored by the API) ──

  protected isSelf(u: AdminUser): boolean {
    return u.id === this.selfId();
  }

  protected isLastAdmin(u: AdminUser): boolean {
    return u.isActive && u.role === ROLES.admin && this.activeAdmins() <= 1;
  }

  /** Why the user can't be removed / suspended, or `null` when allowed. */
  protected protectedReason(u: AdminUser): string | null {
    if (this.isSelf(u)) return 'لا يمكنك تنفيذ هذا الإجراء على حسابك';
    if (this.isLastAdmin(u)) return 'آخر مدير نظام نشط';
    return null;
  }

  // ── Actions ──

  protected setTab(tab: UsersTab): void {
    this.state.setParam('tab', tab === 'users' ? null : tab);
  }

  protected showRole(role: Role): void {
    this.state.setParam('tab', null);
    this.state.setFilter('role', role);
  }

  protected openCreate(): void {
    this.state.setParam('user', 'new');
  }

  protected edit(u: AdminUser): void {
    this.state.setParam('user', u.id);
  }

  protected closeDrawer(): void {
    this.state.setParam('user', null);
  }

  protected onSaved(): void {
    this.closeDrawer();
    this.refresh();
  }

  protected refresh(): void {
    this.list.reload();
    this.stats.reload();
  }

  protected async toggleActive(u: AdminUser): Promise<void> {
    if (u.isActive) {
      const reason = this.protectedReason(u);
      if (reason) {
        this.toast.warning(reason);
        return;
      }
      const confirmed = await this.dialog.confirm({
        title: 'إيقاف المستخدم',
        message: `لن يتمكن «${u.name}» من تسجيل الدخول حتى يُعاد تفعيله، وستنتهي جلسته الحالية عند أول تحديث. هل تريد المتابعة؟`,
        confirmText: 'إيقاف',
        type: 'warning',
      });
      if (!confirmed) return;
    }
    this.busyId.set(u.id);
    this.users.setActive(u.id, !u.isActive).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(u.isActive ? `تم إيقاف ${u.name}` : `تم تفعيل ${u.name}`);
        this.refresh();
      },
      error: () => this.busyId.set(null),
    });
  }

  protected async remove(u: AdminUser): Promise<void> {
    const reason = this.protectedReason(u);
    if (reason) {
      this.toast.warning(reason);
      return;
    }
    const confirmed = await this.dialog.confirm({
      title: 'حذف المستخدم',
      message: `سيتم حذف حساب «${u.name}» نهائيًا ولن يتمكن من الدخول. للإيقاف المؤقت استخدم «إيقاف» بدلًا من الحذف. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.busyId.set(u.id);
    this.users.delete(u.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success('تم حذف المستخدم');
        this.refresh();
      },
      error: () => this.busyId.set(null),
    });
  }
}
