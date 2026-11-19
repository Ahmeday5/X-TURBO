import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { catchError, EMPTY, finalize, Subscription, switchMap, timer } from 'rxjs';
import { PERMISSIONS } from '../../../core/auth/permissions';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NavBadgeService } from '../../../core/services/nav-badge.service';
import { DriverStats } from '../models/driver.model';
import { DriversService } from './drivers.service';

const POLL_MS = 60_000;
const PROBLEMS_NAV_ID = 'order-problems';

/**
 * Delivery counters (`GET drivers/stats`), refreshed every minute while a
 * staff member who can see them is signed in — there is no realtime channel
 * for the dashboard. Feeds the drivers screen tiles and the "open problems"
 * badge on the sidebar. Started once from the main layout.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryStatsService {
  private readonly api = inject(DriversService);
  private readonly auth = inject(AuthService);
  private readonly badges = inject(NavBadgeService);

  private readonly value = signal<DriverStats | null>(null);
  private readonly fetching = signal(false);
  private poll: Subscription | null = null;

  readonly stats = this.value.asReadonly();
  readonly loading = this.fetching.asReadonly();

  private readonly allowed = computed(
    () => this.auth.isAuthenticated() && this.auth.hasAnyPermission([PERMISSIONS.orders, PERMISSIONS.users]),
  );

  constructor() {
    effect(() => {
      const allowed = this.allowed();
      untracked(() => (allowed ? this.start() : this.stop()));
    });

    effect(() => {
      const s = this.value();
      const canSeeProblems = this.auth.hasPermission(PERMISSIONS.orders);
      untracked(() => this.badges.set(PROBLEMS_NAV_ID, canSeeProblems ? (s?.openProblems ?? 0) : 0));
    });

    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Call after any change that moves the counters (assign, resolve, suspend…). */
  refresh(): void {
    if (this.allowed()) this.start();
  }

  /** (Re)starts the minute loop with an immediate fetch. */
  private start(): void {
    this.poll?.unsubscribe();
    this.poll = timer(0, POLL_MS)
      .pipe(
        switchMap(() => {
          this.fetching.set(true);
          // A failed tick keeps the last numbers and must not end the loop.
          return this.api.stats().pipe(
            catchError(() => EMPTY),
            finalize(() => this.fetching.set(false)),
          );
        }),
      )
      .subscribe((s) => this.value.set(s));
  }

  private stop(): void {
    this.poll?.unsubscribe();
    this.poll = null;
    this.value.set(null);
    this.fetching.set(false);
  }
}
