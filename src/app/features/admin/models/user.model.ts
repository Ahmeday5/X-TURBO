import { ALL_PERMISSIONS, Permission, PERMISSIONS as P } from '../../../core/auth/permissions';
import { Role, ROLES, roleLabel } from '../../../core/auth/roles';
import { NAV_SECTIONS } from '../../../core/constants/nav.constants';
import { isNavGroup } from '../../../core/models/nav.model';
import { IconName } from '../../../shared/components/icon/icon.component';
import { StatusView } from '../../../shared/models/status-tone.model';

/** A system user as the admin API returns it (never carries the password). */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  /** ISO date-time; `null` = never signed in. */
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UserStatus = 'active' | 'suspended';

export interface UserPayload {
  name: string;
  email: string;
  phone: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  /** Required on create, ignored on update (use reset-password). */
  password?: string;
}

export interface UserStats {
  total: number;
  active: number;
  suspended: number;
  byRole: Record<string, number>;
  /** Active users with the Admin role — the last one is protected. */
  activeAdmins: number;
}

export const USER_ROLES: readonly Role[] = Object.values(ROLES);

export const USER_STATUS_VIEW: Record<UserStatus, StatusView> = {
  active: { label: 'نشط', tone: 'good', color: 'var(--gr)' },
  suspended: { label: 'موقوف', tone: 'danger', color: 'var(--re)' },
};

export interface RoleView {
  role: Role;
  label: string;
  hint: string;
  icon: IconName;
  color: string;
}

export const ROLE_VIEW: Record<Role, RoleView> = {
  [ROLES.admin]: {
    role: ROLES.admin,
    label: roleLabel(ROLES.admin),
    hint: 'وصول كامل لكل الشاشات وإدارة المستخدمين والإعدادات',
    icon: 'shield',
    color: 'var(--primary)',
  },
  [ROLES.warehouseManager]: {
    role: ROLES.warehouseManager,
    label: roleLabel(ROLES.warehouseManager),
    hint: 'الأصناف والمخازن والأرصدة وسندات الصرف والاستلام',
    icon: 'warehouse',
    color: 'var(--am)',
  },
  [ROLES.cashier]: {
    role: ROLES.cashier,
    label: roleLabel(ROLES.cashier),
    hint: 'نقطة البيع والطلبات والفواتير والتحصيل',
    icon: 'store',
    color: 'var(--gr)',
  },
  [ROLES.accountant]: {
    role: ROLES.accountant,
    label: roleLabel(ROLES.accountant),
    hint: 'السندات والحسابات والمدفوعات والتقارير المالية',
    icon: 'calculator',
    color: 'var(--bl)',
  },
};

/** Default permission set applied when a role is picked (still editable per user). */
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.admin]: ALL_PERMISSIONS,
  [ROLES.warehouseManager]: [P.dashboard, P.items, P.warehouses, P.inventory, P.invoices],
  [ROLES.cashier]: [P.dashboard, P.orders, P.invoices, P.pos, P.customers, P.payments],
  [ROLES.accountant]: [P.dashboard, P.reports, P.invoices, P.customers, P.vouchers, P.payments, P.accounts],
};

// ── Permission catalog (derived from the sidebar so labels never drift) ──

export interface PermissionInfo {
  key: Permission;
  label: string;
  hint: string;
  icon: IconName;
}

export interface PermissionGroup {
  section: string;
  permissions: PermissionInfo[];
}

/**
 * Every permission grouped by the sidebar section that first uses it, labelled
 * with that nav entry (and its pages as the hint). Permissions no nav entry
 * uses land in a trailing "أخرى" group so nothing is ever unassignable.
 */
function buildCatalog(): PermissionGroup[] {
  const seen = new Set<string>();
  const groups: PermissionGroup[] = [];

  for (const section of NAV_SECTIONS) {
    const permissions: PermissionInfo[] = [];
    for (const entry of section.items) {
      const pages = isNavGroup(entry) ? entry.children : [];
      const gates = new Set<string>([...(entry.permissions ?? []), ...pages.flatMap((c) => c.permissions ?? [])]);
      for (const key of gates) {
        if (seen.has(key) || !(ALL_PERMISSIONS as readonly string[]).includes(key)) continue;
        seen.add(key);
        const hint = pages.length
          ? pages.map((c) => c.label).slice(0, 4).join('، ') + (pages.length > 4 ? '…' : '')
          : ('description' in entry && entry.description) || `الوصول إلى شاشة ${entry.label}`;
        permissions.push({ key: key as Permission, label: entry.label, hint, icon: entry.icon });
      }
    }
    if (permissions.length) groups.push({ section: section.label, permissions });
  }

  const rest = ALL_PERMISSIONS.filter((p) => !seen.has(p));
  if (rest.length) {
    groups.push({
      section: 'أخرى',
      permissions: rest.map((key) => ({ key, label: key, hint: '', icon: 'lock' as IconName })),
    });
  }
  return groups;
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = buildCatalog();

const PERMISSION_INDEX = new Map<string, PermissionInfo>(
  PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, p] as const)),
);

export function permissionLabel(key: string): string {
  return PERMISSION_INDEX.get(key)?.label ?? key;
}

/** Keeps known permissions only, in catalog order (stable payloads / diffs). */
export function normalizePermissions(keys: readonly string[]): Permission[] {
  const set = new Set(keys);
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}

// ── Password policy (shared by the form, the reset dialog and the mock) ──

export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: '8 أحرف على الأقل', test: (v) => v.length >= 8 },
  { id: 'upper', label: 'حرف إنجليزي كبير (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'حرف إنجليزي صغير (a-z)', test: (v) => /[a-z]/.test(v) },
  { id: 'digit', label: 'رقم واحد على الأقل', test: (v) => /\d/.test(v) },
  { id: 'symbol', label: 'رمز خاص مثل @ # !', test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

export function passwordIssues(value: string): string[] {
  return PASSWORD_RULES.filter((r) => !r.test(value)).map((r) => r.label);
}

/** Random password that satisfies every rule. */
export function generatePassword(length = 12): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '@#$%&!?'];
  const all = sets.join('');
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
