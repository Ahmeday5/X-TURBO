import {
  NUMBERING_KINDS,
  NumberingRule,
  PREFIX_PATTERN,
  SystemSettings,
  SystemSettingsPayload,
} from '../../features/admin/models/settings.model';
import { AdminUser, USER_ROLES, UserPayload, UserStats } from '../../features/admin/models/user.model';
import { actorName } from '../db/db-utils';
import { setSystemSettings, systemSettings } from '../db/settings.db';
import {
  activeAdminCount,
  createUser,
  deleteUser,
  findUser,
  resetUserPassword,
  setUserActive,
  updateUser,
  userRows,
} from '../db/users.db';
import { warehouseRows } from '../db/warehouses.db';
import { bodyOf, CollectionOptions, filterCollection, queryCollection } from '../mock-collection';
import { fail, MockContext, MockRoute, ok } from '../mock-http';
import { API_ENDPOINTS } from '../../core/constants/api-endpoints.const';

// ── Users ──

const LIST_OPTIONS: CollectionOptions<AdminUser> = {
  searchFields: ['name', 'email', 'phone'],
  filters: {
    role: (row, v) => row.role === v,
    status: (row, v) => (v === 'active' ? row.isActive : v === 'suspended' ? !row.isActive : true),
  },
};

function list({ query }: MockContext) {
  if (!query.get('sortBy')) {
    query.set('sortBy', 'name');
    query.set('sortDir', 'asc');
  }
  return ok(queryCollection(userRows(), query, LIST_OPTIONS));
}

function stats({ query }: MockContext) {
  const q = new URLSearchParams();
  q.set('search', query.get('search') ?? '');
  const rows = filterCollection(userRows(), q, LIST_OPTIONS);
  const byRole: Record<string, number> = Object.fromEntries(USER_ROLES.map((r) => [r, 0]));
  for (const r of rows) byRole[r.role] = (byRole[r.role] ?? 0) + 1;
  const result: UserStats = {
    total: rows.length,
    active: rows.filter((r) => r.isActive).length,
    suspended: rows.filter((r) => !r.isActive).length,
    byRole,
    activeAdmins: activeAdminCount(),
  };
  return ok(result);
}

function get({ params, req }: MockContext) {
  return ok(findUser(params['id'], req.url));
}

function create({ req }: MockContext) {
  return ok(createUser(bodyOf<UserPayload>(req.body), req.url), 201);
}

function update({ params, req, userId }: MockContext) {
  return ok(updateUser(params['id'], bodyOf<UserPayload>(req.body), userId, req.url));
}

function remove({ params, req, userId }: MockContext) {
  deleteUser(params['id'], userId, req.url);
  return ok(null);
}

function setStatus({ params, req, userId }: MockContext) {
  const { isActive } = bodyOf<{ isActive: boolean }>(req.body);
  return ok(setUserActive(params['id'], !!isActive, userId, req.url));
}

function resetPassword({ params, req }: MockContext) {
  resetUserPassword(params['id'], bodyOf<{ password: string }>(req.body).password, req.url);
  return ok(null);
}

// ── Settings ──

function getSettings() {
  return ok(systemSettings());
}

function int(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function saveSettings({ req, userId }: MockContext) {
  const p = bodyOf<SystemSettingsPayload>(req.body);
  const url = req.url;
  const c = p.company ?? ({} as SystemSettingsPayload['company']);
  const f = p.financial ?? ({} as SystemSettingsPayload['financial']);
  const inv = p.inventory ?? ({} as SystemSettingsPayload['inventory']);

  const name = (c.name ?? '').trim();
  if (!name) throw fail(422, 'اسم الشركة مطلوب', url);
  const initials = (c.logoInitials ?? '').trim();
  if (!initials || initials.length > 3) throw fail(422, 'حروف الشعار من حرف إلى 3 أحرف', url);

  const vat = Number(f.vatRate);
  if (!(vat >= 0 && vat <= 100)) throw fail(422, 'نسبة الضريبة يجب أن تكون بين 0 و 100', url);
  const month = int(f.fiscalYearStartMonth);
  if (!(month >= 1 && month <= 12)) throw fail(422, 'شهر بداية السنة المالية غير صالح', url);
  const decimals = int(f.decimalPlaces);
  if (!(decimals >= 0 && decimals <= 4)) throw fail(422, 'عدد الخانات العشرية من 0 إلى 4', url);

  const numbering: NumberingRule[] = NUMBERING_KINDS.map((kind) => {
    const r = p.numbering?.find((x) => x.kind === kind);
    if (!r) throw fail(422, 'إعدادات الترقيم ناقصة', url);
    const prefix = (r.prefix ?? '').trim().toUpperCase();
    if (!PREFIX_PATTERN.test(prefix)) throw fail(422, `بادئة غير صالحة: «${r.prefix}»`, url);
    const next = int(r.nextNumber);
    if (!(next >= 1)) throw fail(422, `الرقم التالي لـ ${prefix} يجب أن يكون 1 أو أكثر`, url);
    const digits = int(r.digits);
    if (!(digits >= 1 && digits <= 10)) throw fail(422, 'عدد خانات الرقم من 1 إلى 10', url);
    return { kind, prefix, nextNumber: next, digits };
  });
  const prefixes = numbering.map((r) => r.prefix);
  const dup = prefixes.find((x, i) => prefixes.indexOf(x) !== i);
  if (dup) throw fail(422, `البادئة «${dup}» مكررة لأكثر من مستند`, url);

  const threshold = int(inv.lowStockThreshold);
  if (!(threshold >= 0)) throw fail(422, 'حد التنبيه للمخزون يجب أن يكون 0 أو أكثر', url);
  if (inv.defaultWarehouseId) {
    const wh = warehouseRows().find((w) => w.id === inv.defaultWarehouseId);
    if (!wh) throw fail(404, 'المخزن غير موجود', url);
    if (!wh.isActive) throw fail(422, `المخزن «${wh.name}» موقوف`, url);
  }

  const next: SystemSettings = {
    company: {
      name: name.slice(0, 120),
      taxNumber: (c.taxNumber ?? '').trim().slice(0, 30),
      commercialRegister: (c.commercialRegister ?? '').trim().slice(0, 30),
      phone: (c.phone ?? '').trim().slice(0, 20),
      email: (c.email ?? '').trim().slice(0, 80),
      address: (c.address ?? '').trim().slice(0, 250),
      logoInitials: initials.toUpperCase(),
    },
    financial: {
      baseCurrency: 'EGP',
      vatRate: Math.round(vat * 100) / 100,
      pricesIncludeTax: !!f.pricesIncludeTax,
      fiscalYearStartMonth: month,
      decimalPlaces: decimals,
    },
    numbering,
    inventory: {
      allowNegativeStock: !!inv.allowNegativeStock,
      lowStockThreshold: threshold,
      defaultWarehouseId: inv.defaultWarehouseId || null,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: actorName(userId),
  };
  setSystemSettings(next);
  return ok(systemSettings());
}

const BY_ID = `${API_ENDPOINTS.users.list}/:id`;

// Literal paths before `users/:id` (first match wins).
export const ADMIN_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: API_ENDPOINTS.users.stats, protected: true, handle: stats },
  { method: 'GET', path: API_ENDPOINTS.users.list, protected: true, handle: list },
  { method: 'POST', path: API_ENDPOINTS.users.list, protected: true, handle: create },
  { method: 'GET', path: BY_ID, protected: true, handle: get },
  { method: 'PUT', path: BY_ID, protected: true, handle: update },
  { method: 'DELETE', path: BY_ID, protected: true, handle: remove },
  { method: 'POST', path: `${BY_ID}/status`, protected: true, handle: setStatus },
  { method: 'POST', path: `${BY_ID}/reset-password`, protected: true, handle: resetPassword },
  { method: 'GET', path: API_ENDPOINTS.settings.root, protected: true, handle: getSettings },
  { method: 'PUT', path: API_ENDPOINTS.settings.root, protected: true, handle: saveSettings },
];

