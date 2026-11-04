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
  pos: 'Pos.Access',
  customers: 'Customers.View',
  shipping: 'Shipping.View',

  products: 'Products.View',
  categories: 'Categories.View',

  inventory: 'Inventory.View',
  warehouses: 'Warehouses.View',
  transfers: 'Transfers.View',

  suppliers: 'Suppliers.View',
  purchasing: 'Purchasing.View',

  accounting: 'Accounting.View',
  invoices: 'Invoices.View',
  payments: 'Payments.View',

  users: 'Users.Manage',
  settings: 'Settings.Manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);
