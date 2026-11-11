import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { formatInteger, formatRelative } from '../../../../shared/utils/format.util';
import { CampaignComposerComponent } from '../../components/campaign-composer/campaign-composer.component';
import { CampaignDrawerComponent } from '../../components/campaign-drawer/campaign-drawer.component';
import { DeliveryBarComponent } from '../../components/delivery-bar/delivery-bar.component';
import {
  Campaign,
  CAMPAIGN_REF_LABEL,
  CAMPAIGN_TARGET_LABEL,
  isDelivering,
  readRate,
} from '../../models/notification-campaign.model';
import { CampaignTracker } from '../../services/campaign-tracker.service';
import { NotificationCampaignsService } from '../../services/notification-campaigns.service';

type Tab = 'compose' | 'history';

const TABS: readonly { key: Tab; label: string; icon: IconName }[] = [
  { key: 'compose', label: 'إرسال إشعار', icon: 'bell' },
  { key: 'history', label: 'سجل الإرسال', icon: 'clock' },
];

/** Mobile push notifications: compose & send, then follow delivery in the history. Tab + drawer live in the URL. */
@Component({
  selector: 'app-mobile-notifications-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CampaignTracker],
  imports: [
    CampaignComposerComponent,
    CampaignDrawerComponent,
    DataTableComponent,
    DeliveryBarComponent,
    IconComponent,
    ListToolbarComponent,
    PageHeaderComponent,
    PaginationComponent,
    RowTemplateDirective,
  ],
  templateUrl: './mobile-notifications.page.html',
  styleUrl: './mobile-notifications.page.scss',
})
export class MobileNotificationsPage {
  private readonly service = inject(NotificationCampaignsService);
  private readonly tracker = inject(CampaignTracker);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({
    pageSize: 12,
    defaultSort: { key: 'createdAt', dir: 'desc' },
    filters: [],
  });

  protected readonly tabs = TABS;
  private readonly tabParam = this.state.param('tab');
  protected readonly tab = computed<Tab>(() => (this.tabParam() === 'history' ? 'history' : 'compose'));
  /** Open drawer, mirrored to `?campaign=`. */
  protected readonly openId = this.state.param('campaign');

  protected readonly list = createListResource(this.state.query, (q) => this.service.list(q));

  /** Rows with live counters swapped in while they deliver. */
  protected readonly rows = computed(() => {
    const live = this.tracker.live();
    return this.list.items().map((c) => live[c.id] ?? c);
  });

  protected readonly sortOptions: SortOption[] = [
    { key: 'createdAt', label: 'تاريخ الإرسال' },
    { key: 'title', label: 'العنوان' },
    { key: 'recipientCount', label: 'عدد المستلمين' },
  ];

  private readonly messageCell = viewChild.required<TemplateRef<{ $implicit: Campaign }>>('messageCell');
  private readonly audienceCell = viewChild.required<TemplateRef<{ $implicit: Campaign }>>('audienceCell');
  private readonly deliveryCell = viewChild.required<TemplateRef<{ $implicit: Campaign }>>('deliveryCell');
  private readonly readCell = viewChild.required<TemplateRef<{ $implicit: Campaign }>>('readCell');
  private readonly dateCell = viewChild.required<TemplateRef<{ $implicit: Campaign }>>('dateCell');

  protected readonly columns = computed<TableColumn<Campaign>[]>(() => [
    { key: 'title', label: 'الإشعار', sortable: true, cellTemplate: this.messageCell() },
    { key: 'recipientCount', label: 'المستلمون', sortable: true, align: 'center', cellTemplate: this.audienceCell() },
    { key: 'sent', label: 'الوصول (وصل / بدون جهاز / فشل)', width: '240px', cellTemplate: this.deliveryCell() },
    { key: 'readCount', label: 'قرأه', align: 'center', cellTemplate: this.readCell() },
    { key: 'createdAt', label: 'أُرسل', sortable: true, cellTemplate: this.dateCell() },
  ]);

  protected readonly targetLabel = CAMPAIGN_TARGET_LABEL;
  protected readonly refLabel = CAMPAIGN_REF_LABEL;
  protected readonly integer = formatInteger;
  protected readonly relative = formatRelative;
  protected readonly rate = readRate;
  protected readonly delivering = isDelivering;

  constructor() {
    // Rows still delivering keep updating in place.
    effect(() => {
      const items = this.list.items();
      untracked(() => items.forEach((c) => this.tracker.track(c)));
    });
  }

  protected setTab(tab: Tab): void {
    this.state.setParam('tab', tab === 'compose' ? null : tab);
  }

  protected open(campaign: Campaign): void {
    this.state.setParam('campaign', campaign.id);
  }

  protected closeDrawer(): void {
    this.state.setParam('campaign', null);
  }

  /** After sending: show it in the history with its live progress open. */
  protected onSent(campaign: Campaign): void {
    this.tracker.track(campaign);
    // Newest first on page 1, so the campaign just sent is the top row.
    this.state.setParams({ tab: 'history', campaign: campaign.id, q: null, sort: null, dir: null }, true);
    this.list.reload();
  }
}
