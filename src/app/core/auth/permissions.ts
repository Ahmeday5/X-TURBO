/**
 * Permission keys understood by the UI. They must match the strings the
 * backend returns in the user's `permissions` array.
 *
 * Used by NAV_SECTIONS (sidebar visibility), route guards and the
 * `*hasPermission` directive — never hard-code a permission string elsewhere.
 */
export const PERMISSIONS = {
  dashboard: 'Dashboard.View',
  reports: 'Reports.View',

  orders: 'Orders.View',
  invoices: 'Invoices.View',
  pos: 'Pos.Access',

  items: 'Items.View',
  warehouses: 'Warehouses.View',
  inventory: 'Inventory.View',

  customers: 'Customers.View',
  vouchers: 'Vouchers.View',
  payments: 'Payments.View',
  accounts: 'Accounts.View',

  users: 'Users.Manage',
  settings: 'Settings.Manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);
