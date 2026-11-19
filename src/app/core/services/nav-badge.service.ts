import { Injectable, signal } from '@angular/core';

/**
 * Live counters shown next to sidebar pages (keyed by nav id). Features push
 * their numbers here; the sidebar only reads. `0` hides the badge.
 */
@Injectable({ providedIn: 'root' })
export class NavBadgeService {
  private readonly counts = signal<Readonly<Record<string, number>>>({});

  readonly all = this.counts.asReadonly();

  set(navId: string, count: number): void {
    if ((this.counts()[navId] ?? 0) === count) return;
    this.counts.update((c) => ({ ...c, [navId]: count }));
  }

  clear(navId: string): void {
    this.set(navId, 0);
  }
}
