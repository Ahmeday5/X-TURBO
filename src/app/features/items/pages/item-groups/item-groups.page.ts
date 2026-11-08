import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, startWith, switchMap } from 'rxjs';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/list/list-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { GroupFormDialogComponent } from '../../components/group-form-dialog/group-form-dialog.component';
import { ItemGroup } from '../../models/item-group.model';
import { ItemGroupsService } from '../../services/item-groups.service';

/** Item groups: list (table/cards) with create / edit in a modal. */
@Component({
  selector: 'app-item-groups',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    PaginationComponent,
    IconComponent,
    GroupFormDialogComponent,
  ],
  templateUrl: './item-groups.page.html',
  styleUrl: './item-groups.page.scss',
})
export class ItemGroupsPage {
  private readonly api = inject(ItemGroupsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'name', dir: 'asc' },
    filters: ['status'],
    defaultView: 'cards',
  });
  protected readonly list = createListResource(this.state.query, (q) => this.api.list(q));

  /** Parent options — refreshed after every write so new groups appear. */
  private readonly refreshLookup$ = new Subject<void>();
  protected readonly parents = toSignal(
    this.refreshLookup$.pipe(
      startWith(undefined),
      switchMap(() => this.api.lookup()),
    ),
    { initialValue: [] },
  );

  /** `undefined` → dialog closed, `null` → creating, group → editing. */
  protected readonly editing = signal<ItemGroup | null | undefined>(undefined);

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: ItemGroup }>>('nameCell');
  private readonly countCell = viewChild.required<TemplateRef<{ $implicit: ItemGroup }>>('countCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: ItemGroup }>>('statusCell');
  private readonly codeCell = viewChild.required<TemplateRef<{ $implicit: ItemGroup }>>('codeCell');

  protected readonly columns = computed<TableColumn<ItemGroup>[]>(() => [
    { key: 'code', label: 'الكود', sortable: true, width: '110px', cellTemplate: this.codeCell() },
    { key: 'name', label: 'المجموعة', sortable: true, cellTemplate: this.nameCell() },
    { key: 'parentName', label: 'المجموعة الرئيسية' },
    { key: 'itemsCount', label: 'عدد الأصناف', sortable: true, align: 'center', cellTemplate: this.countCell() },
    { key: 'isActive', label: 'الحالة', align: 'center', cellTemplate: this.statusCell() },
  ]);

  protected readonly sortOptions: SortOption[] = [
    { key: 'name', label: 'الاسم' },
    { key: 'code', label: 'الكود' },
    { key: 'itemsCount', label: 'عدد الأصناف' },
  ];

  protected onSaved(): void {
    this.editing.set(undefined);
    this.list.reload();
    this.refreshLookup$.next();
  }

  protected openItems(group: ItemGroup): void {
    this.router.navigate(['/items/directory'], { queryParams: { groupId: group.id } });
  }

  protected async remove(group: ItemGroup): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'حذف المجموعة',
      message: `سيتم حذف مجموعة «${group.name}». هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete(group.id).subscribe(() => {
      this.toast.success('تم حذف المجموعة');
      this.onSaved();
    });
  }
}
