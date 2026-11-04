import { computed, inject, Injectable } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';
import { NAV_SECTIONS } from '../constants/nav.constants';
import { MenuItem, MenuSection } from '../models/menu-item.model';

/**
 * Single source of the navigation the current user may see. The sidebar and
 * the topbar search both read from here, so visibility rules live in one place
 * and re-evaluate automatically on login / cross-tab session changes.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly auth = inject(AuthService);

  /** Sections with hidden items removed; empty sections are dropped entirely. */
  readonly sections = computed<MenuSection[]>(() => {
    const permissions = this.auth.permissionSet();
    const role = this.auth.currentUser()?.role;
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => this.isVisible(item, permissions, role)),
    })).filter((section) => section.items.length > 0);
  });

  /** Flat list of visible items, each tagged with its section label. */
  readonly items = computed(() =>
    this.sections().flatMap((section) => section.items.map((item) => ({ ...item, section: section.label }))),
  );

  /** Case-insensitive match on label, section and keywords. */
  search(term: string): Array<MenuItem & { section: string }> {
    const q = term.trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter((item) =>
      [item.label, item.section, ...(item.keywords ?? [])].some((text) => text.toLowerCase().includes(q)),
    );
  }

  private isVisible(item: MenuItem, permissions: ReadonlySet<string>, role: string | undefined): boolean {
    const hasPermGate = !!item.permissions?.length;
    const hasRoleGate = !!item.roles?.length;
    // No gate at all → visible to everyone.
    if (!hasPermGate && !hasRoleGate) return true;
    // Gates are OR-ed: an item declaring both shows when the user satisfies *either*.
    const permMatch = hasPermGate && item.permissions!.some((p) => permissions.has(p));
    const roleMatch = hasRoleGate && !!role && item.roles!.includes(role);
    return permMatch || roleMatch;
  }
}
