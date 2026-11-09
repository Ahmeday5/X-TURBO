import { Permission } from '../../core/auth/permissions';
import { Role, ROLES } from '../../core/auth/roles';
import {
  AdminUser,
  normalizePermissions,
  passwordIssues,
  ROLE_DEFAULT_PERMISSIONS,
  USER_ROLES,
  UserPayload,
} from '../../features/admin/models/user.model';
import { fail } from '../mock-http';
import { DEMO_USERS, MockUser, setMockUserDirectory } from '../mock-users';
import { daysAgo } from '../mock-utils';
import { findOr404, requireText } from './db-utils';

/** Stored row — the password never leaves the mock. */
interface UserRecord extends AdminUser {
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let rows: UserRecord[] | null = null;
let nextNo = 1;

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function seed(): UserRecord[] {
  const demo: UserRecord[] = DEMO_USERS.map((u, i) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: i === 0 ? '01001234567' : '01112345678',
    password: u.password,
    role: u.role,
    permissions: normalizePermissions(u.permissions),
    isActive: true,
    lastLoginAt: hoursAgo(i === 0 ? 0.2 : 5),
    createdAt: daysAgo(420 - i * 30),
    updatedAt: daysAgo(40),
  }));

  const extra: Array<[string, string, Role, boolean, number | null, string]> = [
    ['كريم محمود', 'karim@xturbo.com', ROLES.admin, true, 26, '01005558899'],
    ['يوسف إبراهيم', 'youssef@xturbo.com', ROLES.cashier, true, 1.5, '01223344556'],
    ['سارة فتحي', 'sara@xturbo.com', ROLES.cashier, true, 30, '01098765432'],
    ['محمد سمير', 'm.samir@xturbo.com', ROLES.cashier, false, 24 * 45, '01155667788'],
    ['هبة عبد الله', 'heba@xturbo.com', ROLES.accountant, true, 3, '01287654321'],
    ['عمرو خالد', 'amr@xturbo.com', ROLES.accountant, true, 24 * 4, '01033445566'],
    ['طارق نبيل', 'tarek@xturbo.com', ROLES.warehouseManager, true, 48, '01544332211'],
    ['نورا أشرف', 'noura@xturbo.com', ROLES.warehouseManager, false, null, '01066778899'],
    ['إسلام رضا', 'eslam@xturbo.com', ROLES.cashier, true, null, '01277889900'],
  ];

  const more = extra.map(([name, email, role, isActive, lastLoginH, phone], i): UserRecord => {
    const permissions = [...ROLE_DEFAULT_PERMISSIONS[role]];
    // A couple of hand-tuned exceptions so the checklist isn't always the role default.
    if (email === 'sara@xturbo.com') permissions.push('Reports.View' as Permission);
    if (email === 'amr@xturbo.com') permissions.splice(permissions.indexOf('Reports.View' as Permission), 1);
    return {
      id: `u-${String(i + 1).padStart(3, '0')}`,
      name,
      email,
      phone,
      password: 'User@1234',
      role,
      permissions: normalizePermissions(permissions),
      isActive,
      lastLoginAt: lastLoginH === null ? null : hoursAgo(lastLoginH),
      createdAt: daysAgo(300 - i * 25),
      updatedAt: daysAgo(Math.max(1, 60 - i * 5)),
    };
  });
  nextNo = more.length + 1;
  return [...demo, ...more];
}

function db(): UserRecord[] {
  return (rows ??= seed());
}

export function toAdminUser({ password: _pw, ...u }: UserRecord): AdminUser {
  return { ...u, permissions: [...u.permissions] };
}

export function userRows(): AdminUser[] {
  return db().map(toAdminUser);
}

export function findUser(id: string, url: string): AdminUser {
  return toAdminUser(findOr404(db(), id, url, 'المستخدم'));
}

function isActiveAdmin(u: Pick<AdminUser, 'role' | 'isActive'>): boolean {
  return u.isActive && u.role === ROLES.admin;
}

export function activeAdminCount(): number {
  return db().filter(isActiveAdmin).length;
}

function validate(p: UserPayload, url: string, selfId: string | null): Omit<UserPayload, 'password'> {
  const name = requireText(p.name, 'اسم المستخدم مطلوب', url);
  const email = requireText(p.email, 'البريد الإلكتروني مطلوب', url).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw fail(422, 'البريد الإلكتروني غير صالح', url);
  if (db().some((u) => u.email.toLowerCase() === email && u.id !== selfId)) {
    throw fail(409, 'البريد الإلكتروني مستخدم لحساب آخر', url);
  }
  if (!USER_ROLES.includes(p.role)) throw fail(422, 'اختر دور المستخدم', url);
  const permissions = normalizePermissions(p.permissions ?? []);
  if (!permissions.length) throw fail(422, 'امنح المستخدم صلاحية واحدة على الأقل', url);
  return {
    name: name.slice(0, 80),
    email,
    phone: (p.phone ?? '').trim().slice(0, 20),
    role: p.role,
    permissions,
    isActive: p.isActive !== false,
  };
}

function checkPassword(password: unknown, url: string): string {
  const pw = typeof password === 'string' ? password : '';
  const issues = passwordIssues(pw);
  if (issues.length) throw fail(422, `كلمة المرور ضعيفة: ${issues.join('، ')}`, url);
  return pw;
}

/** Throws when removing `target` from the active-admin pool would leave none. */
function guardLastAdmin(target: UserRecord, stillAdmin: boolean, url: string, action: string): void {
  if (isActiveAdmin(target) && !stillAdmin && activeAdminCount() <= 1) {
    throw fail(422, `لا يمكن ${action} آخر مدير نظام نشط`, url);
  }
}

export function createUser(p: UserPayload, url: string): AdminUser {
  const v = validate(p, url, null);
  const password = checkPassword(p.password, url);
  const now = new Date().toISOString();
  const row: UserRecord = {
    ...v,
    id: `u-${String(nextNo++).padStart(3, '0')}-${Date.now().toString(36)}`,
    password,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db().unshift(row);
  return toAdminUser(row);
}

export function updateUser(id: string, p: UserPayload, actorId: string | null, url: string): AdminUser {
  const row = findOr404(db(), id, url, 'المستخدم');
  const v = validate(p, url, id);
  if (id === actorId) {
    if (!v.isActive) throw fail(422, 'لا يمكنك إيقاف حسابك', url);
    if (v.role !== row.role) throw fail(422, 'لا يمكنك تغيير دورك بنفسك', url);
    if (!v.permissions.includes('Users.Manage')) throw fail(422, 'لا يمكنك سحب صلاحية إدارة المستخدمين من حسابك', url);
  }
  guardLastAdmin(row, isActiveAdmin(v), url, 'تغيير دور أو إيقاف');
  Object.assign(row, v, { updatedAt: new Date().toISOString() });
  return toAdminUser(row);
}

export function setUserActive(id: string, isActive: boolean, actorId: string | null, url: string): AdminUser {
  const row = findOr404(db(), id, url, 'المستخدم');
  if (!isActive) {
    if (id === actorId) throw fail(422, 'لا يمكنك إيقاف حسابك', url);
    guardLastAdmin(row, false, url, 'إيقاف');
  }
  row.isActive = !!isActive;
  row.updatedAt = new Date().toISOString();
  return toAdminUser(row);
}

export function deleteUser(id: string, actorId: string | null, url: string): void {
  const row = findOr404(db(), id, url, 'المستخدم');
  if (id === actorId) throw fail(422, 'لا يمكنك حذف حسابك', url);
  guardLastAdmin(row, false, url, 'حذف');
  rows = db().filter((u) => u.id !== id);
}

export function resetUserPassword(id: string, password: unknown, url: string): void {
  const row = findOr404(db(), id, url, 'المستخدم');
  row.password = checkPassword(password, url);
  row.updatedAt = new Date().toISOString();
}

// ── Login directory: users managed here can sign in (suspended / deleted can't). ──

setMockUserDirectory(() =>
  db()
    .filter((u) => u.isActive)
    .map(
      (u): MockUser => ({
        id: u.id,
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        permissions: u.permissions,
      }),
    ),
);
