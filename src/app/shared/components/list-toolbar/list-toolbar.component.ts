import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SortState } from '../../../core/models/list-query.model';
import { ViewMode } from '../../list/url-list-state';
import { IconComponent } from '../icon/icon.component';

export interface SortOption {
  key: string;
  label: string;
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * List toolbar: debounced search, filter slot, sort picker (needed in card
 * view, where there are no headers) and the table/cards switch.
 *
 *   <app-list-toolbar [search]="state.query().search" (searchChange)="state.setSearch($event)" …>
 *     <select filters …></select>
 *   </app-list-toolbar>
 */
@Component({
  selector: 'app-list-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './list-toolbar.component.html',
  styleUrl: './list-toolbar.component.scss',
})
export class ListToolbarComponent {
  readonly search = input('');
  readonly placeholder = input('بحث…');
  readonly view = input<ViewMode>('table');
  readonly sort = input<SortState | null>(null);
  readonly sortOptions = input<readonly SortOption[]>([]);
  readonly count = input<number | null>(null);
  readonly activeFilters = input(0);

  readonly searchChange = output<string>();
  readonly sortChange = output<SortState | null>();
  readonly viewChange = output<ViewMode>();
  readonly clearFilters = output<void>();

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  protected readonly term = signal('');
  private readonly typed$ = new Subject<string>();

  protected readonly sortValue = computed(() => {
    const s = this.sort();
    return s ? `${s.key}:${s.dir}` : '';
  });

  constructor() {
    this.typed$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((value) => this.searchChange.emit(value));

    // URL → field (back/forward, "clear filters"), never while the user is typing.
    effect(
      () => {
        const external = this.search();
        untracked(() => {
          if (document.activeElement !== this.input().nativeElement) this.term.set(external);
        });
      },
      { allowSignalWrites: true },
    );
  }

  protected onType(value: string): void {
    this.term.set(value);
    this.typed$.next(value.trim());
  }

  protected clear(): void {
    this.term.set('');
    this.typed$.next('');
    this.input().nativeElement.focus();
  }

  protected onSort(value: string): void {
    if (!value) return this.sortChange.emit(null);
    const [key, dir] = value.split(':');
    this.sortChange.emit({ key, dir: dir === 'desc' ? 'desc' : 'asc' });
  }
}
