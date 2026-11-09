import { ALL_PERMISSIONS, Permission, PERMISSIONS as P } from '../core/auth/permissions';
import { ROLES, Role } from '../core/auth/roles';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  permissions: readonly Permission[];
}

/** Built-in demo accounts — also listed on the login page while the mock is on. */
export const DEMO_USERS: readonly MockUser[] = [
  {
    id: 'u-admin',
    name: 'أحمد حسن',
    email: 'admin@xturbo.com',
    password: 'Admin@123',
    role: ROLES.admin,
    permissions: ALL_PERMISSIONS,
  },
  {
    id: 'u-warehouse',
    name: 'منى عادل',
    email: 'warehouse@xturbo.com',
    password: 'Warehouse@123',
    role: ROLES.warehouseManager,
    permissions: [
      P.dashboard,
      P.items,
      P.warehouses,
      P.inventory,
      // Stock transfers, goods issue/receipt live in the invoices module.
      P.invoices,
    ],
  },
];

/**
 * Live login directory. Defaults to DEMO_USERS; the admin users store
 * (`db/users.db.ts`) replaces it so created / edited / suspended users apply.
 */
let directory: () => readonly MockUser[] = () => DEMO_USERS;

export function setMockUserDirectory(source: () => readonly MockUser[]): void {
  directory = source;
}

export function findUserByEmail(email: string): MockUser | undefined {
  const needle = email.trim().toLowerCase();
  return directory().find((u) => u.email.toLowerCase() === needle);
}

export function findUserById(id: string): MockUser | undefined {
  return directory().find((u) => u.id === id);
}
