/** A grouping of items (e.g. "الفرامل", "الفلاتر"). */
export interface ItemGroup {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  description: string;
  /** Accent colour used on chips and cards. */
  color: string;
  isActive: boolean;
  /** Computed by the server. */
  itemsCount: number;
  createdAt: string;
}

export type ItemGroupPayload = Pick<ItemGroup, 'name' | 'parentId' | 'description' | 'color' | 'isActive'>;

/** Minimal shape for selects and filters. */
export interface ItemGroupOption {
  id: string;
  name: string;
  color: string;
}

/** Palette offered in the group form; tuned to read on both themes. */
export const GROUP_COLORS = [
  '#e31e24', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#64748b',
] as const;
