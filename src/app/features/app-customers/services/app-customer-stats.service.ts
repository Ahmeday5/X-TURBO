import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { catchError, EMPTY, finalize, Subscription, switchMap, tap, timer } from 'rxjs';
import { PERMISSIONS } from '../../../core/auth/permissions';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NavBadgeService } from '../../../core/services/nav-badge.service';
import { AppCustomerStats } from '../models/app-customer.model';
import { AppCustomersService } from './app-customers.service';

const POLL_MS = 60_000;
/** Must match the nav entry id in NAV_SECTIONS. */
export const APP_CUSTOMERS_NAV_ID = 'app-customers';

/**
 * App-customer counters (`GET app-customers/stats`) for the status tabs and the
 * sidebar badge (number of `pending` sign-ups). Fetched at sign-in, every
 * minute after that (new sign-ups arrive any time — there's no realtime
 * channel), when the screen opens and after every activate / block.
 * Started once from the main layout; idle without `Customers.View`.
 */
@Injectable({ providedIn: 'root' })
export class AppCustomerStatsService {
  private readonly api = inject(AppCustomersService);
  private readonly auth = inject(AuthService);
  private readonly badges = inject(NavBadgeService);

  private readonly value = signal<AppCustomerStats | null>(null);
  private readonly fetching = signal(false);
  private readonly lastFailed = signal(false);
  private poll: Subscription | null = null;

  readonly stats = this.value.asReadonly();
  readonly loading = this.fetching.asReadonly();
  /** The last fetch failed and there are no numbers to show. */
  readonly failed = computed(() => this.lastFailed() && !this.value());

  private readonly allowed = computed(() => this.auth.isAuthenticated() && this.auth.hasPermission(PERMISSIONS.customers));

  constructor() {
    effect(() => {
      const allowed = this.allowed();
      untracked(() => (allowed ? this.start() : this.stop()));
    });

    effect(() => {
      const pending = this.value()?.pending ?? 0;
      untracked(() => this.badges.set(APP_CUSTOMERS_NAV_ID, pending));
    });

    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Fetch now (and restart the minute loop) — call after anything that moves the counters. */
  refresh(): void {
    if (this.allowed()) this.start();
  }

  private start(): void {
    this.poll?.unsubscribe();
    this.poll = timer(0, POLL_MS)
      .pipe(
        switchMap(() => {
          this.fetching.set(true);
          // A failed tick keeps the last numbers and must not end the loop.
          return this.api.stats().pipe(
            tap({ error: () => this.lastFailed.set(true) }),
            catchError(() => EMPTY),
            finalize(() => this.fetching.set(false)),
          );
        }),
      )
      .subscribe((s) => {
        this.lastFailed.set(false);
        this.value.set(s);
      });
  }

  private stop(): void {
    this.poll?.unsubscribe();
    this.poll = null;
    this.value.set(null);
    this.fetching.set(false);
    this.lastFailed.set(false);
  }
}
