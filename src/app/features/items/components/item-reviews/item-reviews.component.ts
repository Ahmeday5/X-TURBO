import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, TemplateRef, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { DateRange, DateRangeComponent } from '../../../../shared/components/date-range/date-range.component';
import { FilterSelectComponent } from '../../../../shared/components/filter-select/filter-select.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { RatingStarsComponent } from '../../../../shared/components/rating-stars/rating-stars.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { formatDateTime, formatInteger } from '../../../../shared/utils/format.util';
import {
  HIDE_REASON_MAX,
  isEdited,
  ItemReview,
  REVIEW_FILTERS,
  reviewQueryParams,
  STAR_FILTER_OPTIONS,
  VISIBILITY_FILTER_OPTIONS,
} from '../../models/item-review.model';
import { ItemReviewsService } from '../../services/item-reviews.service';

/** Shown on hide / show actions. */
const HIDDEN_HINT = 'التقييم المخفي لا يظهر في التطبيق ولا يُحتسب في متوسط التقييم';

/**
 * «التقييمات» tab of the item screen: summary (average + distribution,
 * unaffected by filters), URL-synced filters, the reviews list with
 * hide / show moderation.
 */
@Component({
  selector: 'app-item-reviews',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    DataTableComponent,
    ListToolbarComponent,
    FilterSelectComponent,
    DateRangeComponent,
    PaginationComponent,
    ModalComponent,
    RatingStarsComponent,
  ],
  templateUrl: './item-reviews.component.html',
  styleUrl: './item-reviews.component.scss',
})
export class ItemReviewsComponent {
  private readonly api = inject(ItemReviewsService);
  private readonly toast = inject(ToastService);

  readonly itemId = input.required<string>();

  protected readonly int = formatInteger;
  protected readonly dateTime = formatDateTime;
  protected readonly edited = isEdited;
  protected readonly hiddenHint = HIDDEN_HINT;
  protected readonly reasonMax = HIDE_REASON_MAX;
  protected readonly starOptions = STAR_FILTER_OPTIONS;
  protected readonly visibilityOptions = VISIBILITY_FILTER_OPTIONS;

  // ── Query (URL) ──

  protected readonly state = new UrlListState({
    pageSize: 10,
    defaultSort: { key: 'createdAt', dir: 'desc' },
    filters: REVIEW_FILTERS,
  });

  protected readonly sortOptions: SortOption[] = [
    { key: 'createdAt', label: 'تاريخ التقييم' },
    { key: 'updatedAt', label: 'آخر تعديل' },
    { key: 'rating', label: 'عدد النجوم' },
    { key: 'customerName', label: 'اسم العميل' },
  ];

  private readonly request = computed(() => ({ itemId: this.itemId(), query: this.state.query() }));
  protected readonly data = createQueryResource(this.request, (r) => this.api.list(r.itemId, reviewQueryParams(r.query)), {
    errorMessage: 'تعذّر تحميل التقييمات',
  });

  /** Rows updated by a hide/show action, shown until the next fetch lands. */
  private readonly overrides = signal<ReadonlyMap<string, ItemReview>>(new Map());

  protected readonly summary = computed(() => this.data.value()?.summary ?? null);
  protected readonly rows = computed(() =>
    (this.data.value()?.reviews.data ?? []).map((r) => this.overrides().get(r.id) ?? r),
  );
  protected readonly count = computed(() => this.data.value()?.reviews.count ?? 0);
  protected readonly totalPages = computed(() => this.data.value()?.reviews.totalPages ?? 0);

  /** Distribution 5★ → 1★ with the share of each. */
  protected readonly bars = computed(() => {
    const s = this.summary();
    const total = s?.distribution.reduce((n, b) => n + b.count, 0) ?? 0;
    return [5, 4, 3, 2, 1].map((rating) => {
      const count = s?.distribution.find((b) => b.rating === rating)?.count ?? 0;
      return { rating, count, pct: total ? Math.round((count / total) * 100) : 0 };
    });
  });

  /** The item has no reviews at all (vs. "nothing matches the filters"). */
  protected readonly noReviewsAtAll = computed(() => {
    const s = this.summary();
    return !!s && s.reviewsCount + s.hiddenCount === 0;
  });

  protected readonly hasFilters = computed(() => this.state.activeFilters() > 0 || !!this.state.query().search);

  // ── Table ──

  private readonly ratingCell = viewChild.required<TemplateRef<{ $implicit: ItemReview }>>('ratingCell');
  private readonly commentCell = viewChild.required<TemplateRef<{ $implicit: ItemReview }>>('commentCell');
  private readonly customerCell = viewChild.required<TemplateRef<{ $implicit: ItemReview }>>('customerCell');
  private readonly orderCell = viewChild.required<TemplateRef<{ $implicit: ItemReview }>>('orderCell');
  private readonly dateCell = viewChild.required<TemplateRef<{ $implicit: ItemReview }>>('dateCell');

  protected readonly columns = computed<TableColumn<ItemReview>[]>(() => [
    { key: 'rating', label: 'التقييم', sortable: true, width: '110px', cellTemplate: this.ratingCell() },
    { key: 'comment', label: 'التعليق', cellTemplate: this.commentCell() },
    { key: 'customerName', label: 'العميل', sortable: true, cellTemplate: this.customerCell() },
    { key: 'orderNumber', label: 'الطلب', cellTemplate: this.orderCell() },
    { key: 'createdAt', label: 'التاريخ', sortable: true, cellTemplate: this.dateCell() },
  ]);

  // ── Hide dialog ──

  protected readonly hiding = signal<ItemReview | null>(null);
  protected readonly hideReason = signal('');
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    // A fresh page from the server supersedes local overrides.
    effect(() => {
      this.data.value();
      untracked(() => this.overrides.set(new Map()));
    });
  }

  // ── Filters ──

  /** Clicking a distribution bar filters by that star count (again = clear). */
  protected toggleStars(rating: number): void {
    const current = this.state.query().filters['stars'];
    this.state.setFilter('stars', current === String(rating) ? null : String(rating));
  }

  protected activeStars(rating: number): boolean {
    return this.state.query().filters['stars'] === String(rating);
  }

  protected setHasComment(checked: boolean): void {
    this.state.setFilter('hasComment', checked ? 'true' : null);
  }

  protected setRange(range: DateRange): void {
    this.state.setFilters({ from: range.from, to: range.to });
  }

  protected clearAll(): void {
    this.state.clearFilters();
  }

  // ── Moderation ──

  protected openHide(r: ItemReview): void {
    this.hideReason.set('');
    this.hiding.set(r);
  }

  protected confirmHide(): void {
    const r = this.hiding();
    if (!r) return;
    const reason = this.hideReason().trim().slice(0, HIDE_REASON_MAX);
    this.hiding.set(null);
    this.changeVisibility(r, true, reason || null);
  }

  protected show(r: ItemReview): void {
    this.changeVisibility(r, false, null);
  }

  private changeVisibility(r: ItemReview, isHidden: boolean, reason: string | null): void {
    this.busyId.set(r.id);
    this.api
      .setVisibility(this.itemId(), r.id, isHidden ? { isHidden, reason } : { isHidden })
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe((updated) => {
        // Row first (instant feedback), then refetch: the summary's average and counts changed.
        this.overrides.update((m) => new Map(m).set(updated.id, updated));
        this.toast.success(isHidden ? 'تم إخفاء التقييم من التطبيق' : 'تم إظهار التقييم في التطبيق');
        this.data.reload();
      });
  }
}
