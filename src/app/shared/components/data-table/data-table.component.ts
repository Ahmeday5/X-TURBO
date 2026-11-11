import { ChangeDetectionStrategy, Component, computed, inject, input, output, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SortState } from '../../../core/models/list-query.model';
import { ViewportService } from '../../../core/services/viewport.service';
import { ViewMode } from '../../list/url-list-state';
import { IconComponent, IconName } from '../icon/icon.component';
import { shouldActivateRow } from '../../utils/row-activation.util';

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  /** Logical alignment — 'start'/'end' follow the reading direction. */
  align?: 'start' | 'end' | 'center';
  cellTemplate?: TemplateRef<{ $implicit: T }>;
}

/**
 * Server-driven data view: a sortable table or a card grid (always cards on
 * phones), with skeleton, empty and error states built in. It renders —
 * paging, sorting and fetching belong to the page (see UrlListState).
 *
 *   <app-data-table [columns]="columns" [data]="list.items()" [view]="state.view()"
 *     [sort]="state.query().sort" (sortChange)="state.toggleSort($event)"
 *     [loading]="list.loading()" [initialLoading]="list.initialLoading()"
 *     [cardTemplate]="card" [actionsTemplate]="actions" />
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, IconComponent],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent<T extends Record<string, any>> {
  private readonly viewport = inject(ViewportService);

  readonly columns = input.required<TableColumn<T>[]>();
  readonly data = input.required<T[]>();
  readonly trackByKey = input<string>('id');

  readonly view = input<ViewMode>('table');
  readonly sort = input<SortState | null>(null);
  readonly loading = input(false);
  readonly initialLoading = input(false);
  readonly error = input<string | null>(null);
  readonly skeletonCount = input(6);

  readonly cardTemplate = input<TemplateRef<{ $implicit: T }> | null>(null);
  readonly actionsTemplate = input<TemplateRef<{ $implicit: T }> | null>(null);
  readonly rowClickable = input(false);

  readonly emptyIcon = input<IconName>('search');
  readonly emptyTitle = input('لا توجد بيانات');
  readonly emptyText = input('');
  readonly actionsLabel = input('إجراءات');

  readonly sortChange = output<string>();
  readonly rowClick = output<T>();

  /**
   * Row / card activation (click or Enter) → `rowClick`. Ignored when the row
   * isn't clickable, when the click landed on something interactive inside a
   * cell (a link, button, input…), or when the user was selecting text to copy.
   */
  protected activate(row: T, event: Event): void {
    if (this.rowClickable() && shouldActivateRow(event)) this.rowClick.emit(row);
  }
  readonly retry = output<void>();

  /** Phones always get cards — a wide table is unusable there. */
  protected readonly mode = computed<ViewMode>(() => (this.viewport.isMobile() ? 'cards' : this.view()));
  protected readonly skeletons = computed(() => Array.from({ length: this.skeletonCount() }, (_, i) => i));

  protected rowKey(row: T): unknown {
    return row[this.trackByKey()];
  }

  protected cellValue(row: T, key: string): unknown {
    const value = key.split('.').reduce<any>((v, k) => v?.[k], row);
    return value ?? '—';
  }

  protected sortDir(key: string): 'asc' | 'desc' | null {
    const sort = this.sort();
    return sort?.key === key ? sort.dir : null;
  }

  protected ariaSort(col: TableColumn<T>): string | null {
    if (!col.sortable) return null;
    const dir = this.sortDir(col.key);
    return dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none';
  }
}
