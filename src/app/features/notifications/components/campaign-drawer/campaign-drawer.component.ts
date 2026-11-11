import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { DrawerComponent } from '../../../../shared/components/drawer/drawer.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { formatDateTime, formatInteger } from '../../../../shared/utils/format.util';
import {
  CAMPAIGN_REF_LABEL,
  CAMPAIGN_TARGET_LABEL,
  isDelivering,
  readRate,
} from '../../models/notification-campaign.model';
import { CampaignTracker } from '../../services/campaign-tracker.service';
import { NotificationCampaignsService } from '../../services/notification-campaigns.service';
import { DeliveryBarComponent } from '../delivery-bar/delivery-bar.component';
import { PhonePreviewComponent } from '../phone-preview/phone-preview.component';

/** A sent campaign: message, audience and live delivery / read counters. */
@Component({
  selector: 'app-campaign-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DeliveryBarComponent, DrawerComponent, IconComponent, PhonePreviewComponent],
  templateUrl: './campaign-drawer.component.html',
  styleUrl: './campaign-drawer.component.scss',
})
export class CampaignDrawerComponent {
  private readonly service = inject(NotificationCampaignsService);
  private readonly tracker = inject(CampaignTracker);

  /** Open when set — bound to the `campaign` URL param by the page. */
  readonly campaignId = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly campaign = createQueryResource(this.campaignId, (id) => this.service.get(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل الإشعار',
  });

  /** Freshest copy (live while delivering), only for the campaign asked for. */
  protected readonly current = computed(() => {
    const c = this.campaign.value();
    if (!c || c.id !== this.campaignId()) return null;
    return this.tracker.live()[c.id] ?? c;
  });
  protected readonly delivering = computed(() => {
    const c = this.current();
    return !!c && isDelivering(c);
  });
  protected readonly rate = computed(() => {
    const c = this.current();
    return c ? readRate(c) : 0;
  });

  protected readonly targetLabel = CAMPAIGN_TARGET_LABEL;
  protected readonly refLabel = CAMPAIGN_REF_LABEL;
  protected readonly dateTime = formatDateTime;
  protected readonly integer = formatInteger;

  constructor() {
    // Keep counting while it delivers (no-op if the page already tracks it).
    effect(() => {
      const c = this.campaign.value();
      if (c) untracked(() => this.tracker.track(c));
    });
  }
}
