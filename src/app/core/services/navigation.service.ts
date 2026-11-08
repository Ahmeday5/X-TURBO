import { computed, inject, Injectable } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';
import { NAV_SECTIONS } from '../constants/nav.constants';
import { flattenNav, isNavGroup, NavEntry, NavGate, NavLeaf, NavSection } from '../models/nav.model';
import { matchesAll, tokenize } from '../../shared/utils/arabic-search.util';

/**
 * Single source of the navigation the current user may see. The sidebar, the
 * topbar search and page headers all read from here, so visibility rules live
 * in one place and re-evaluate automatically on login / cross-tab changes.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly auth = inject(AuthService);

  /**
   * The visible tree. Children inherit their group's gate unless they declare
   * their own; groups and sections left empty are dropped entirely.
   */
  readonly sections = computed<NavSection[]>(() => {
    const permissions = this.auth.permissionSet();
    const role = this.auth.currentUser()?.role;
    const visible = (gate: NavGate) => this.passes(gate, permissions, role);

    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.flatMap((entry): NavEntry[] => {
        if (!isNavGroup(entry)) return visible(entry) ? [entry] : [];
        const children = entry.children.filter((child) =>
          visible(child.permissions?.length || child.roles?.length ? child : entry),
        );
        return children.length ? [{ ...entry, children }] : [];
      }),
    })).filter((section) => section.items.length > 0);
  });

  /** Every visible page, flattened, in display order. */
  readonly leaves = computed<NavLeaf[]>(() => flattenNav(this.sections()));

  /** Visible page by id — `undefined` when it doesn't exist or is hidden. */
  leaf(id: string): NavLeaf | undefined {
    return this.leaves().find((leaf) => leaf.id === id);
  }

  /** Visible pages sharing a group with `id` (including itself). */
  siblings(id: string): NavLeaf[] {
    const groupId = this.leaf(id)?.group?.id;
    return groupId ? this.leaves().filter((leaf) => leaf.group?.id === groupId) : [];
  }

  /** Arabic-aware match on label, group, section and keywords; every word must hit. */
  search(term: string): NavLeaf[] {
    const tokens = tokenize(term);
    if (!tokens.length) return this.leaves();
    return this.leaves().filter((leaf) =>
      matchesAll([leaf.label, leaf.group?.label, leaf.section, ...(leaf.keywords ?? [])], tokens),
    );
  }

  /** Gates are OR-ed: a node declaring both shows when the user satisfies *either*. */
  private passes(gate: NavGate, permissions: ReadonlySet<string>, role: string | undefined): boolean {
    const hasPermGate = !!gate.permissions?.length;
    const hasRoleGate = !!gate.roles?.length;
    if (!hasPermGate && !hasRoleGate) return true;
    const permMatch = hasPermGate && gate.permissions!.some((p) => permissions.has(p));
    const roleMatch = hasRoleGate && !!role && gate.roles!.includes(role);
    return permMatch || roleMatch;
  }
}
