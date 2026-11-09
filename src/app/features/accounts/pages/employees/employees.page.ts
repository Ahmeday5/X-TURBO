import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ListQuery } from '../../../../core/models/list-query.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { fetchAllPages } from '../../../../core/utils/api-list.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { BarListComponent, BarListRow } from '../../../../shared/components/charts/bar-list/bar-list.component';
import { DonutChartComponent, DonutSegment } from '../../../../shared/components/charts/donut-chart/donut-chart.component';
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
import { downloadCsv } from '../../../../shared/utils/csv.util';
import { formatInteger, formatMoney, formatMoneyCompact } from '../../../../shared/utils/format.util';
import { Employee, EMPLOYEE_STATUS_VIEW } from '../../models/employee.model';
import { CostCentersService } from '../../services/cost-centers.service';
import { EmployeesService } from '../../services/employees.service';
import { EmployeeEditorComponent } from './employee-editor/employee-editor.component';

const dateFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });

/** "3 سنوات" / "8 أشهر" since an ISO date. */
function tenure(iso: string): string {
  const from = new Date(iso);
  const now = new Date();
  const months = (now.getFullYear() - from.getFullYear()) * 12 + now.getMonth() - from.getMonth() - (now.getDate() < from.getDate() ? 1 : 0);
  if (months < 1) return 'أقل من شهر';
  if (months < 12) return months === 1 ? 'شهر' : months === 2 ? 'شهران' : months <= 10 ? `${months} أشهر` : `${months} شهرًا`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'سنة' : years === 2 ? 'سنتان' : years <= 10 ? `${years} سنوات` : `${years} سنة`;
}

/** Staff directory — headcount & payroll totals, department breakdown, card editor in a drawer. */
@Component({
  selector: 'app-employees-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    BarListComponent,
    DataTableComponent,
    DonutChartComponent,
    EmployeeEditorComponent,
    FilterSelectComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    RowTemplateDirective,
    StatusPillComponent,
    StatusTabsComponent,
    SummaryTilesComponent,
  ],
  templateUrl: './employees.page.html',
  styleUrl: './employees.page.scss',
})
export class EmployeesPage {
  private readonly api = inject(EmployeesService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'code', dir: 'asc' },
    filters: ['status', 'costCenterId'],
  });
  protected readonly list = createListResource(this.state.query, (q) => this.api.list(q));

  /** Stats over the same search + department (the server ignores status). */
  private readonly statsQuery = computed<ListQuery>(
    () => {
      const { search, filters } = this.state.query();
      const f: Record<string, string> = {};
      if (filters['costCenterId']) f['costCenterId'] = filters['costCenterId'];
      return { pageIndex: 1, pageSize: 1, search, sort: null, filters: f };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly stats = createQueryResource(this.statsQuery, (q) => this.api.stats(q));

  protected readonly centers = toSignal(inject(CostCentersService).lookup(), { initialValue: [] });
  protected readonly centerOptions = computed<FilterOption[]>(() => this.centers().map((c) => ({ value: c.id, label: c.name })));

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const s = this.stats.value();
    return [
      { label: 'عدد الموظفين', icon: 'users', value: s?.headcount ?? null, format: formatInteger, hint: 'على رأس العمل وفي إجازة' },
      { label: 'على رأس العمل', icon: 'check', value: s?.active ?? null, format: formatInteger, tone: 'var(--gr)' },
      { label: 'في إجازة', icon: 'calendar', value: s?.onLeave ?? null, format: formatInteger, tone: 'var(--am)' },
      {
        label: 'إجمالي الرواتب الشهرية',
        icon: 'wallet',
        value: s?.totalSalaries ?? null,
        format: formatMoneyCompact,
        tone: 'var(--bl)',
        hint: s ? `متوسط الراتب ${formatMoney(s.averageSalary)}` : undefined,
      },
    ];
  });

  protected readonly tabs = computed<StatusTab[]>(() => {
    const s = this.stats.value();
    return [
      { value: null, label: 'الكل', color: 'var(--primary)', count: null },
      { value: 'active', label: EMPLOYEE_STATUS_VIEW.active.label, color: EMPLOYEE_STATUS_VIEW.active.color, count: s?.active ?? null },
      { value: 'leave', label: EMPLOYEE_STATUS_VIEW.leave.label, color: EMPLOYEE_STATUS_VIEW.leave.color, count: s?.onLeave ?? null },
      { value: 'terminated', label: EMPLOYEE_STATUS_VIEW.terminated.label, color: EMPLOYEE_STATUS_VIEW.terminated.color, count: null },
    ];
  });

  protected readonly deptSegments = computed<DonutSegment[]>(() =>
    (this.stats.value()?.byDepartment ?? []).map((d) => ({ key: d.costCenterId ?? 'none', label: d.name, value: d.count, color: d.color })),
  );
  protected readonly deptSalaries = computed<BarListRow[]>(() =>
    (this.stats.value()?.byDepartment ?? []).map((d) => ({
      key: d.costCenterId ?? 'none',
      label: d.name,
      sub: `${formatInteger(d.count)} موظف · متوسط ${formatMoney(d.count ? Math.round(d.salaries / d.count) : 0)}`,
      value: d.salaries,
      display: formatMoney(d.salaries),
    })),
  );

  protected readonly sortOptions: SortOption[] = [
    { key: 'code', label: 'الكود' },
    { key: 'name', label: 'الاسم' },
    { key: 'hireDate', label: 'تاريخ التعيين' },
    { key: 'salary', label: 'الراتب' },
  ];

  private readonly codeCell = viewChild.required<TemplateRef<{ $implicit: Employee }>>('codeCell');
  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: Employee }>>('nameCell');
  private readonly deptCell = viewChild.required<TemplateRef<{ $implicit: Employee }>>('deptCell');
  private readonly phoneCell = viewChild.required<TemplateRef<{ $implicit: Employee }>>('phoneCell');
  private readonly hireCell = viewChild.required<TemplateRef<{ $implicit: Employee }>>('hireCell');
  private readonly salaryCell = viewChild.required<TemplateRef<{ $implicit: Employee }>>('salaryCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: Employee }>>('statusCell');

  protected readonly columns = computed<TableColumn<Employee>[]>(() => [
    { key: 'code', label: 'الكود', sortable: true, width: '110px', cellTemplate: this.codeCell() },
    { key: 'name', label: 'الموظف', sortable: true, cellTemplate: this.nameCell() },
    { key: 'costCenterName', label: 'القسم', cellTemplate: this.deptCell() },
    { key: 'phone', label: 'الموبايل', cellTemplate: this.phoneCell() },
    { key: 'hireDate', label: 'تاريخ التعيين', sortable: true, cellTemplate: this.hireCell() },
    { key: 'salary', label: 'الراتب', sortable: true, align: 'end', cellTemplate: this.salaryCell() },
    { key: 'status', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
  ]);

  protected readonly statusView = EMPLOYEE_STATUS_VIEW;
  protected readonly money = formatMoney;
  protected readonly int = formatInteger;
  protected readonly date = (iso: string): string => (iso ? dateFmt.format(new Date(iso)) : '—');
  protected readonly tenure = tenure;
  protected readonly exporting = signal(false);

  /** Drawer state: `'new'`, the employee being edited, or closed. */
  protected readonly editing = signal<Employee | 'new' | null>(null);
  protected readonly editingEmployee = computed(() => {
    const e = this.editing();
    return e && e !== 'new' ? e : null;
  });

  protected create(): void {
    this.editing.set('new');
  }

  protected edit(e: Employee): void {
    this.editing.set(e);
  }

  protected onSaved(): void {
    this.editing.set(null);
    this.refresh();
  }

  protected refresh(): void {
    this.list.reload();
    this.stats.reload();
  }

  protected async remove(e: Employee): Promise<void> {
    if (e.status !== 'terminated') {
      this.toast.warning('لا يُحذف موظف على رأس العمل — غيّر حالته إلى «انتهت خدمته» أولًا');
      return;
    }
    const confirmed = await this.dialog.confirm({
      title: 'حذف بطاقة الموظف',
      message: `سيتم حذف بطاقة «${e.name}» (${e.code}) نهائيًا. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete(e.id).subscribe(() => {
      this.toast.success('تم حذف بطاقة الموظف');
      this.refresh();
    });
  }

  protected export(): void {
    const query = this.state.query();
    this.exporting.set(true);
    fetchAllPages((pageIndex, pageSize) => this.api.list({ ...query, pageIndex, pageSize }), 100)
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe((rows) => {
        downloadCsv(`employees-${new Date().toISOString().slice(0, 10)}`, rows, [
          { label: 'الكود', value: (e) => e.code },
          { label: 'الاسم', value: (e) => e.name },
          { label: 'المسمى الوظيفي', value: (e) => e.jobTitle },
          { label: 'القسم', value: (e) => e.costCenterName ?? '' },
          { label: 'الموبايل', value: (e) => e.phone },
          { label: 'الرقم القومي', value: (e) => e.nationalId },
          { label: 'تاريخ التعيين', value: (e) => (e.hireDate ?? '').slice(0, 10) },
          { label: 'الراتب الشهري', value: (e) => e.salary },
          { label: 'حساب السلف', value: (e) => e.advancesAccountName ?? '' },
          { label: 'الحالة', value: (e) => EMPLOYEE_STATUS_VIEW[e.status].label },
          { label: 'ملاحظات', value: (e) => e.notes },
        ]);
        this.toast.success(`تم تصدير ${formatInteger(rows.length)} موظف`);
      });
  }
}
