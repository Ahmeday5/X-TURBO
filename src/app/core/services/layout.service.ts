import { inject, Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';

const COLLAPSED_KEY = 'xturbo_sidebar_collapsed';

/**
 * Sidebar collapse (desktop, persisted) + mobile drawer open/close state for
 * the main layout.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly storage = inject(StorageService);

  readonly collapsed = signal(this.storage.get(COLLAPSED_KEY) === '1');
  readonly mobileOpen = signal(false);

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
    this.storage.set(COLLAPSED_KEY, this.collapsed() ? '1' : '0');
  }
  openMobile(): void { this.mobileOpen.set(true); }
  closeMobile(): void { this.mobileOpen.set(false); }
  toggleMobile(): void { this.mobileOpen.update((v) => !v); }
}
