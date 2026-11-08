import { IconName } from '../../shared/components/icon/icon.component';

/**
 * Visibility gate shared by every navigation node. `permissions` and `roles`
 * are OR-ed: the node shows when the user satisfies *either*. A node with no
 * gate at all is visible to everyone.
 */
export interface NavGate {
  permissions?: readonly string[];
  roles?: readonly string[];
}

/** A routable page. */
export interface NavLink extends NavGate {
  id: string;
  label: string;
  route: string;
  icon: IconName;
  /** One-line summary shown on the page header and on related-page cards. */
  description?: string;
  /** Extra words the searches should match (synonyms, common spellings). */
  keywords?: readonly string[];
}

/**
 * A collapsible module holding related pages. Children with no gate of their
 * own inherit the group's gate.
 */
export interface NavGroup extends NavGate {
  id: string;
  label: string;
  icon: IconName;
  children: readonly NavLink[];
  keywords?: readonly string[];
}

export type NavEntry = NavLink | NavGroup;

export interface NavSection {
  label: string;
  items: readonly NavEntry[];
}

/** A page flattened out of the tree, with its effective gate and location. */
export interface NavLeaf extends NavLink {
  section: string;
  group?: Pick<NavGroup, 'id' | 'label' | 'icon'>;
}

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

/** A child with no gate of its own falls back to its group's gate. */
function inheritGate(link: NavLink, group?: NavGroup): NavLink {
  if (!group || link.permissions?.length || link.roles?.length) return link;
  return { ...link, permissions: group.permissions, roles: group.roles };
}

/** Every page in the tree, in display order. */
export function flattenNav(sections: readonly NavSection[]): NavLeaf[] {
  return sections.flatMap((section) =>
    section.items.flatMap((entry): NavLeaf[] =>
      isNavGroup(entry)
        ? entry.children.map((child) => ({
            ...inheritGate(child, entry),
            section: section.label,
            group: { id: entry.id, label: entry.label, icon: entry.icon },
          }))
        : [{ ...entry, section: section.label }],
    ),
  );
}
