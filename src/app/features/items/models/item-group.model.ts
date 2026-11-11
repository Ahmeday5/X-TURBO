/**
 * A grouping of items, arranged as a tree: main group → sub-groups → …
 * Items attach to LEAF groups only (no children) — the server answers
 * 409 `GROUP_NOT_LEAF` otherwise, and refuses children under a group that
 * already holds items (409 `GROUP_HAS_ITEMS`).
 */
export interface ItemGroup {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  description: string;
  /** Accent colour used on chips and cards. */
  color: string;
  /** Public absolute URL — usable directly in `<img src>`. */
  imageUrl: string | null;
  isActive: boolean;
  /** Items attached directly to this group (computed by the server). */
  itemsCount: number;
  createdAt: string;
}

/** Node of `GET item-groups/tree`. */
export interface ItemGroupNode extends Omit<ItemGroup, 'parentName'> {
  /** Items in this group and every group below it. */
  totalItemsCount: number;
  children: ItemGroupNode[];
}

export type ItemGroupPayload = Pick<ItemGroup, 'name' | 'parentId' | 'description' | 'color' | 'isActive'>;

/** Minimal shape for selects and filters. */
export interface ItemGroupOption {
  id: string;
  name: string;
  color: string;
}

/** Business-rule codes of the groups API (409). */
export const GROUP_ERROR_CODES = {
  /** Delete refused, or a sub-group can't be created under a group that holds items. */
  hasItems: 'GROUP_HAS_ITEMS',
  /** Delete refused while sub-groups exist. */
  hasChildren: 'GROUP_HAS_CHILDREN',
  /** An item was attached to a group that has sub-groups. */
  notLeaf: 'GROUP_NOT_LEAF',
} as const;

/** Group image rules (validated before upload; the server enforces them too). */
export const GROUP_IMAGE_RULES = {
  types: ['image/jpeg', 'image/png', 'image/webp'] as readonly string[],
  maxBytes: 5 * 1024 * 1024,
} as const;

/** Palette offered in the group form; tuned to read on both themes. */
export const GROUP_COLORS = [
  '#e31e24', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#64748b',
] as const;

// ───────────── tree helpers (pure) ─────────────

/**
 * House rule: items live under SUB-groups only. A main (root) group that holds
 * items directly is misplaced — it should be moved under a main group.
 */
export const isMisplacedRoot = (g: Pick<ItemGroup, 'parentId' | 'itemsCount'>): boolean =>
  !g.parentId && g.itemsCount > 0;

/** Where an item may be attached: a sub-group (has a parent) with no sub-groups of its own. */
export const acceptsItems = (g: FlatGroup): boolean => g.isLeaf && g.depth > 0;

/** A node flattened with its depth and ancestry — for selects and indented lists. */
export interface FlatGroup {
  node: ItemGroupNode;
  depth: number;
  /** "الفرامل › تيل" — ancestors joined, for search and labels. */
  path: string;
  isLeaf: boolean;
}

/** Depth-first flattening (parents before children), names sorted per level. */
export function flattenGroups(nodes: readonly ItemGroupNode[], depth = 0, parentPath = ''): FlatGroup[] {
  return [...nodes]
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    .flatMap((node) => {
      const path = parentPath ? `${parentPath} › ${node.name}` : node.name;
      return [
        { node, depth, path, isLeaf: !node.children?.length },
        ...flattenGroups(node.children ?? [], depth + 1, path),
      ];
    });
}

/** Ids of a node and all its descendants (a group can't move under any of them). */
export function subtreeIds(node: ItemGroupNode): Set<string> {
  const ids = new Set<string>([node.id]);
  const walk = (n: ItemGroupNode) => n.children?.forEach((c) => (ids.add(c.id), walk(c)));
  walk(node);
  return ids;
}

export function findGroup(nodes: readonly ItemGroupNode[], id: string): ItemGroupNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findGroup(n.children ?? [], id);
    if (hit) return hit;
  }
  return null;
}
