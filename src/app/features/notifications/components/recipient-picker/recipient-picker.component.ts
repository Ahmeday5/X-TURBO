import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, model, signal } from '@angular/core';
import { ListQuery } from '../../../../core/models/list-query.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { createListResource } from '../../../../shared/list/list-resource';
import { formatInteger, formatRelative } from '../../../../shared/utils/format.util';
import { CAMPAIGN_RULES, CampaignCustomer } from '../../models/notification-campaign.model';
import { NotificationCampaignsService } from '../../services/notification-campaigns.service';

type DeviceFilter = '' | 'true' | 'false';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
/** Chips shown before collapsing into "+N". */
const VISIBLE_CHIPS = 24;

/**
 * Pick specific customers (1–1000) for a campaign: server search, a
 * "has a registered phone" filter, paging, and a selection that survives
 * paging/searching. Two-way bound: `[(selected)]`.
 */
@Component({
  selector: 'app-recipient-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PaginationComponent],
  templateUrl: './recipient-picker.component.html',
  styleUrl: './recipient-picker.component.scss',
})
export class RecipientPickerComponent {
  private readonly service = inject(NotificationCampaignsService);

  readonly selected = model<readonly CampaignCustomer[]>([]);

  protected readonly searchText = signal('');
  private readonly search = signal('');
  protected readonly device = signal<DeviceFilter>('');
  protected readonly page = signal(1);

  private readonly query = computed<ListQuery>(() => ({
    pageIndex: this.page(),
    pageSize: PAGE_SIZE,
    search: this.search(),
    sort: { key: 'name', dir: 'asc' },
    filters: this.device() ? { hasFcmToken: this.device() } : ({} as Record<string, string>),
  }));
  protected readonly list = createListResource(this.query, (q) => this.service.customers(q));

  protected readonly max = CAMPAIGN_RULES.maxRecipients;
  protected readonly pageSize = PAGE_SIZE;
  private readonly selectedIds = computed(() => new Set(this.selected().map((c) => c.id)));
  protected readonly full = computed(() => this.selected().length >= this.max);
  protected readonly pageChecked = computed(() => {
    const rows = this.list.items();
    const ids = this.selectedIds();
    const picked = rows.filter((r) => ids.has(r.id)).length;
    return { all: rows.length > 0 && picked === rows.length, some: picked > 0 && picked < rows.length };
  });
  protected readonly chips = computed(() => this.selected().slice(0, VISIBLE_CHIPS));
  protected readonly hiddenChips = computed(() => Math.max(0, this.selected().length - VISIBLE_CHIPS));
  /** Picked customers a push can't reach — they'll only see it in the app. */
  protected readonly withoutDevice = computed(() => this.selected().filter((c) => !c.fcmTokens).length);

  protected readonly integer = formatInteger;
  protected readonly relative = formatRelative;

  private debounce?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.debounce));
  }

  protected isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  protected onSearch(value: string): void {
    this.searchText.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.search.set(value.trim());
      this.page.set(1);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected setDevice(value: string): void {
    this.device.set(value as DeviceFilter);
    this.page.set(1);
  }

  protected toggle(customer: CampaignCustomer): void {
    if (this.isSelected(customer.id)) this.remove(customer.id);
    else if (!this.full()) this.selected.update((list) => [...list, customer]);
  }

  /** Header checkbox: select the page (up to the cap) or clear it. */
  protected togglePage(): void {
    const rows = this.list.items();
    if (this.pageChecked().all) {
      const pageIds = new Set(rows.map((r) => r.id));
      this.selected.update((list) => list.filter((c) => !pageIds.has(c.id)));
      return;
    }
    const room = this.max - this.selected().length;
    const additions = rows.filter((r) => !this.isSelected(r.id)).slice(0, room);
    this.selected.update((list) => [...list, ...additions]);
  }

  protected remove(id: string): void {
    this.selected.update((list) => list.filter((c) => c.id !== id));
  }

  protected clear(): void {
    this.selected.set([]);
  }
}
