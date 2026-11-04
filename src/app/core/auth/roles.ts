/**
 * Role identifiers exactly as the backend sends them, plus their Arabic
 * display names. Identifiers stay stable (used by role gates); only the
 * labels are user-facing.
 */
export const ROLES = {
  admin: 'Admin',
  warehouseManager: 'WarehouseManager',
  cashier: 'Cashier',
  accountant: 'Accountant',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

const ROLE_LABELS: Record<string, string> = {
  [ROLES.admin]: 'مدير النظام',
  [ROLES.warehouseManager]: 'مدير المخازن',
  [ROLES.cashier]: 'كاشير',
  [ROLES.accountant]: 'محاسب',
};

/** Arabic label for a role; unknown roles fall back to the raw value. */
export function roleLabel(role: string | null | undefined): string {
  return role ? (ROLE_LABELS[role] ?? role) : '';
}
