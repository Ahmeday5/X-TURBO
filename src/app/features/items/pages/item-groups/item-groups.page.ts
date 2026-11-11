import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/list/list-resource';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { GroupFormDialogComponent } from '../../components/group-form-dialog/group-form-dialog.component';
import { GroupTreeComponent } from '../../components/group-tree/group-tree.component';
import { flattenGroups, GROUP_ERROR_CODES, isMisplacedRoot, ItemGroup, ItemGroupNode } from '../../models/item-group.model';
import { toItemGroupDetails } from '../../utils/item-details';
import { DetailsDrawerComponent } from '../../../../shared/components/details-drawer/details-drawer.component';
import { ApiError } from '../../../../core/models/api-response.model';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
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
    GroupTreeComponent,
    DetailsDrawerComponent,
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

  /** `?mode=list` → flat paged table; default → the hierarchy. */
  private readonly modeParam = this.state.param('mode');
  protected readonly mode = computed<'tree' | 'list'>(() => (this.modeParam() === 'list' ? 'list' : 'tree'));

  /** The hierarchy — tree view and the dialog's parent picker. Reloaded after every write. */
  protected readonly tree = createQueryResource(signal(true), () => this.api.tree(), {
    errorMessage: 'تعذّر تحميل شجرة المجموعات',
  });
  protected readonly treeSearch = signal('');
  private readonly treeView = viewChild(GroupTreeComponent);
  protected readonly treeStats = computed(() => {
    const flat = flattenGroups(this.tree.value() ?? []);
    return { groups: flat.length, roots: (this.tree.value() ?? []).length, leaves: flat.filter((g) => g.isLeaf).length };
  });

  /** `undefined` → dialog closed, `null` → creating, group → editing. */
  protected readonly editing = signal<ItemGroup | null | undefined>(undefined);
  /** Parent pre-selected when adding a sub-group from the tree. */
  protected readonly newParentId = signal<string | null>(null);
  /** The dialog is fixing a main group that holds items (parent required). */
  protected readonly movingToSub = signal(false);

  /** Main groups holding items directly — items belong under sub-groups only. */
  protected readonly misplaced = computed(() => (this.tree.value() ?? []).filter(isMisplacedRoot));

  // ── Details drawer (👁) ──
  protected readonly viewId = signal<string | null>(null);
  protected readonly viewed = createQueryResource(this.viewId, (id) => this.api.get(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل تفاصيل المجموعة',
  });
  protected readonly details = computed(() => {
    const g = this.viewed.value();
    return g && g.id === this.viewId() ? toItemGroupDetails(g) : null;
  });

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

  protected setMode(mode: 'tree' | 'list'): void {
    this.state.setParam('mode', mode === 'tree' ? null : mode);
  }

  protected expandAll(): void {
    this.treeView()?.expandAll();
  }

  protected collapseAll(): void {
    this.treeView()?.collapseAll();
  }

  protected create(parentId: string | null = null): void {
    this.movingToSub.set(false);
    this.newParentId.set(parentId);
    this.editing.set(null);
  }

  /** Tree nodes lack `parentName` — load the full group for the dialog. */
  protected editNode(node: ItemGroupNode, moveToSub = false): void {
    this.api.get(node.id).subscribe((group) => {
      this.movingToSub.set(moveToSub);
      this.editing.set(group);
    });
  }

  /** Fix a main group that holds items: move it under a main group (it becomes a sub-group). */
  protected makeSub(node: Pick<ItemGroupNode, 'id'>): void {
    this.editNode(node as ItemGroupNode, true);
  }

  protected closeDialog(): void {
    this.editing.set(undefined);
    this.movingToSub.set(false);
  }

  protected removeNode(node: ItemGroupNode): void {
    void this.remove({ ...node, parentName: null });
  }

  protected onSaved(): void {
    this.closeDialog();
    this.newParentId.set(null);
    this.list.reload();
    this.tree.reload();
    if (this.viewId()) this.viewed.reload();
  }

  protected openItems(group: Pick<ItemGroup, 'id'>): void {
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
    this.api.delete(group.id).subscribe({
      next: () => {
        this.toast.success('تم حذف المجموعة');
        this.onSaved();
      },
      error: (err: ApiError) => {
        if (hasErrorCode(err, GROUP_ERROR_CODES.hasItems)) void this.offerShowItems(group, err.message);
        else if (hasErrorCode(err, GROUP_ERROR_CODES.hasChildren)) void this.explainHasChildren(err.message);
        else this.toast.error(err.message);
      },
    });
  }

  /** A group that still has items can't be deleted — offer to open them so they can be moved. */
  private async offerShowItems(group: ItemGroup, serverMessage: string): Promise<void> {
    const show = await this.dialog.confirm({
      title: 'لا يمكن حذف المجموعة',
      message: `${serverMessage || `مجموعة «${group.name}» تحتوي على أصناف.`}\nانقل الأصناف لمجموعة أخرى أو أوقف المجموعة بدلًا من حذفها.`,
      confirmText: 'عرض أصناف المجموعة',
      type: 'warning',
    });
    if (show) this.openItems(group);
  }

  /** Sub-groups must be deleted or moved first — point at them in the tree. */
  private async explainHasChildren(serverMessage: string): Promise<void> {
    const showTree = await this.dialog.confirm({
      title: 'لا يمكن حذف المجموعة',
      message: `${serverMessage}\nاحذف الفروع التي تحتها أو انقلها لمجموعة أخرى أولًا.`,
      confirmText: 'عرض الشجرة',
      type: 'warning',
    });
    if (showTree) {
      this.setMode('tree');
      this.expandAll();
    }
  }
}
