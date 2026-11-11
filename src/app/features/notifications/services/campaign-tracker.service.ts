import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { catchError, EMPTY, expand, finalize, Subscription, switchMap, take, takeWhile, timer } from 'rxjs';
import { Campaign, isDelivering } from '../models/notification-campaign.model';
import { NotificationCampaignsService } from './notification-campaigns.service';

/** Poll cadence while a campaign is delivering. */
const POLL_MS = 3000;
/** Safety cap (~5 min) so a stuck `pending` never polls forever. */
const MAX_POLLS = 100;

/**
 * Live delivery counters. `track()` polls `GET /{id}` every 3 s until
 * `pending = 0`, exposing the freshest copy in `live` so the history table and
 * the details drawer update in place. One poll per campaign; all stop on destroy.
 *
 * Provided by the page — its lifetime is the screen's.
 */
@Injectable()
export class CampaignTracker implements OnDestroy {
  private readonly service = inject(NotificationCampaignsService);
  private readonly polls = new Map<string, Subscription>();

  private readonly _live = signal<Readonly<Record<string, Campaign>>>({});
  /** Latest snapshot per campaign id (only campaigns seen while delivering). */
  readonly live = this._live.asReadonly();

  /** Freshest known copy of a campaign. */
  resolve(campaign: Campaign): Campaign {
    return this._live()[campaign.id] ?? campaign;
  }

  /** Starts polling if it's still delivering (no-op if already tracked or settled). */
  track(campaign: Campaign): void {
    if (!isDelivering(campaign) || this.polls.has(campaign.id)) return;
    this.store(campaign);

    const sub = timer(POLL_MS)
      .pipe(
        switchMap(() => this.service.poll(campaign.id)),
        expand((latest) => (isDelivering(latest) ? timer(POLL_MS).pipe(switchMap(() => this.service.poll(campaign.id))) : EMPTY)),
        take(MAX_POLLS),
        takeWhile((latest) => isDelivering(latest), true),
        // A failed poll ends tracking quietly; the list's refresh button still works.
        catchError(() => EMPTY),
        finalize(() => this.polls.delete(campaign.id)),
      )
      .subscribe((latest) => this.store(latest));
    this.polls.set(campaign.id, sub);
  }

  ngOnDestroy(): void {
    this.polls.forEach((sub) => sub.unsubscribe());
    this.polls.clear();
  }

  private store(campaign: Campaign): void {
    this._live.update((all) => ({ ...all, [campaign.id]: campaign }));
  }
}
