import { Item, ItemPayload, ITEM_UNITS, stockLevel } from '../../features/items/models/item.model';
import { GROUP_COLORS, ItemGroup, ItemGroupOption, ItemGroupPayload } from '../../features/items/models/item-group.model';
import { bodyOf, queryCollection } from '../mock-collection';
import { fail, MockContext, MockRoute, ok } from '../mock-http';
import { daysAgo, seeded } from '../mock-utils';
import { API_ENDPOINTS } from '../../core/constants/api-endpoints.const';

/**
 * In-memory items + groups "database". Seeded deterministically so lists are
 * stable across reloads; writes live until the page is refreshed.
 */

const GROUP_SEED: ReadonlyArray<[name: string, desc: string, parts: string[]]> = [
  ['الفرامل', 'تيل وطنابير وأسطوانات الفرامل', ['تيل فرامل أمامي', 'تيل فرامل خلفي', 'طنبورة فرامل', 'أسطوانة فرامل']],
  ['الفلاتر', 'فلاتر الزيت والهواء والبنزين والتكييف', ['فلتر زيت', 'فلتر هواء', 'فلتر بنزين', 'فلتر تكييف']],
  ['الإشعال', 'البوجيهات والموبينات والأسلاك', ['بوجيه إيريديوم', 'موبينة', 'طقم أسلاك بوجيهات']],
  ['المحرك', 'سيور وجوانات وقطع المحرك', ['طقم سير كاتينة', 'جوان وش سلندر', 'طرمبة مياه', 'سير دينامو']],
  ['العفشة', 'المساعدين والمقصات والبلي', ['مساعد أمامي', 'مساعد خلفي', 'مقص سفلي', 'بلية عجل']],
  ['الكهرباء', 'البطاريات والدينامو والمارش', ['بطارية 70 أمبير', 'دينامو', 'مارش', 'حساس أكسجين']],
  ['الزيوت', 'زيوت المحرك والفتيس والفرامل', ['زيت محرك 5W-30', 'زيت فتيس أوتوماتيك', 'زيت فرامل DOT4']],
  ['التكييف', 'كمبروسر ورادياتير التكييف', ['كمبروسر تكييف', 'رادياتير تكييف', 'مروحة تكييف']],
  ['الإضاءة', 'الفوانيس واللمبات', ['فانوس أمامي', 'فانوس خلفي', 'لمبة LED H4']],
  ['الهيكل', 'الصدامات والمرايات والأبواب', ['صدام أمامي', 'مراية جانبية', 'كبوت']],
  ['الإطارات', 'الكاوتش والجنوط', ['كاوتش 195/65R15', 'جنط ألمونيوم 15']],
  ['الإكسسوارات', 'الدواسات والفرش والكماليات', ['طقم دواسات', 'فرش كراسي', 'شاشة أندرويد']],
];

const CARS = ['تويوتا كورولا', 'هيونداي إلنترا', 'كيا سيراتو', 'نيسان صني', 'شيفروليه لانوس', 'ميتسوبيشي لانسر', 'سكودا أوكتافيا', 'رينو لوجان'];
const BRANDS = ['بوش', 'دينسو', 'NGK', 'فاليو', 'مان', 'أصلي', 'TRW', 'KYB'];

const groups: ItemGroup[] = GROUP_SEED.map(([name, description], i) => ({
  id: `grp-${i + 1}`,
  code: `GR-${String(i + 1).padStart(3, '0')}`,
  name,
  parentId: null,
  parentName: null,
  description,
  color: GROUP_COLORS[i % GROUP_COLORS.length],
  isActive: i !== 11,
  itemsCount: 0,
  createdAt: daysAgo(400 - i * 9),
}));

const items: Item[] = buildItems();
let nextItemNo = items.length + 1;
let nextGroupNo = groups.length + 1;

function buildItems(): Item[] {
  const rand = seeded(2024);
  const out: Item[] = [];
  GROUP_SEED.forEach(([, , parts], g) => {
    parts.forEach((part) => {
      const cars = CARS.filter(() => rand() > 0.55).slice(0, 4);
      for (const car of cars.length ? cars : [CARS[g % CARS.length]]) {
        const n = out.length + 1;
        const purchase = Math.round((90 + rand() * 4200) / 5) * 5;
        const minStock = 5 + Math.floor(rand() * 30);
        out.push({
          id: `itm-${n}`,
          code: `IT-${String(n).padStart(5, '0')}`,
          name: `${part} — ${car}`,
          groupId: groups[g].id,
          groupName: groups[g].name,
          groupColor: groups[g].color,
          unit: ITEM_UNITS[part.includes('طقم') ? 1 : part.includes('زيت') ? 2 : 0],
          barcode: String(6221000000000 + Math.floor(rand() * 999_999_999)),
          brand: BRANDS[Math.floor(rand() * BRANDS.length)],
          purchasePrice: purchase,
          salePrice: Math.round((purchase * (1.18 + rand() * 0.35)) / 5) * 5,
          minStock,
          stock: rand() < 0.08 ? 0 : Math.floor(rand() * minStock * 6),
          description: '',
          compatibleWith: car,
          isActive: rand() > 0.07,
          createdAt: daysAgo(Math.floor(rand() * 360)),
          averageRating: 0,
          reviewsCount: 0,
        });
      }
    });
  });
  return out;
}

// ── Items ──

function listItems({ query }: MockContext) {
  return ok(
    queryCollection(items, query, {
      searchFields: ['name', 'code', 'barcode', 'brand', 'groupName'],
      filters: {
        groupId: (row, v) => row.groupId === v,
        status: (row, v) => (v === 'active' ? row.isActive : !row.isActive),
        stock: (row, v) => stockLevel(row) === v,
      },
    }),
  );
}

function getItem({ params, req }: MockContext) {
  return ok(findOr404(items, params['id'], req.url));
}

function createItem({ req }: MockContext) {
  const payload = validItem(bodyOf<ItemPayload>(req.body), req.url);
  const n = nextItemNo++;
  const item: Item = {
    ...payload,
    ...groupRef(payload.groupId, req.url),
    id: `itm-${n}`,
    code: `IT-${String(n).padStart(5, '0')}`,
    stock: 0,
    createdAt: new Date().toISOString(),
    averageRating: 0,
    reviewsCount: 0,
  };
  items.unshift(item);
  return ok(item, 201);
}

function updateItem({ params, req }: MockContext) {
  const item = findOr404(items, params['id'], req.url);
  const payload = validItem(bodyOf<ItemPayload>(req.body), req.url, item.id);
  Object.assign(item, payload, groupRef(payload.groupId, req.url));
  return ok(item);
}

function deleteItem({ params, req }: MockContext) {
  const item = findOr404(items, params['id'], req.url);
  items.splice(items.indexOf(item), 1);
  return ok(null);
}

function validItem(p: ItemPayload, url: string, selfId?: string): ItemPayload {
  if (!p.name?.trim()) throw fail(422, 'اسم الصنف مطلوب', url);
  if (p.barcode && items.some((i) => i.barcode === p.barcode && i.id !== selfId)) {
    throw fail(409, 'الباركود مستخدم لصنف آخر', url);
  }
  return { ...p, name: p.name.trim(), barcode: p.barcode?.trim() ?? '' };
}

function groupRef(groupId: string, url: string): Pick<Item, 'groupId' | 'groupName' | 'groupColor'> {
  const g = findOr404(groups, groupId, url);
  return { groupId: g.id, groupName: g.name, groupColor: g.color };
}

// ── Groups ──

function withCounts(): ItemGroup[] {
  return groups.map((g) => ({
    ...g,
    itemsCount: items.filter((i) => i.groupId === g.id).length,
    parentName: g.parentId ? (groups.find((p) => p.id === g.parentId)?.name ?? null) : null,
  }));
}

function listGroups({ query }: MockContext) {
  return ok(
    queryCollection(withCounts(), query, {
      searchFields: ['name', 'code', 'description'],
      filters: { status: (row, v) => (v === 'active' ? row.isActive : !row.isActive) },
    }),
  );
}

function lookupGroups() {
  const options: ItemGroupOption[] = groups.filter((g) => g.isActive).map(({ id, name, color }) => ({ id, name, color }));
  return ok(options);
}

function createGroup({ req }: MockContext) {
  const payload = validGroup(bodyOf<ItemGroupPayload>(req.body), req.url);
  const n = nextGroupNo++;
  const group: ItemGroup = {
    ...payload,
    id: `grp-${n}`,
    code: `GR-${String(n).padStart(3, '0')}`,
    parentName: null,
    itemsCount: 0,
    createdAt: new Date().toISOString(),
  };
  groups.unshift(group);
  return ok(group, 201);
}

function updateGroup({ params, req }: MockContext) {
  const group = findOr404(groups, params['id'], req.url);
  const payload = validGroup(bodyOf<ItemGroupPayload>(req.body), req.url, group.id);
  if (payload.parentId === group.id) throw fail(422, 'لا يمكن أن تكون المجموعة أبًا لنفسها', req.url);
  Object.assign(group, payload);
  // Keep denormalised item fields in sync, like the real API would.
  items.filter((i) => i.groupId === group.id).forEach((i) => Object.assign(i, { groupName: group.name, groupColor: group.color }));
  return ok(group);
}

function deleteGroup({ params, req }: MockContext) {
  const group = findOr404(groups, params['id'], req.url);
  if (items.some((i) => i.groupId === group.id)) throw fail(409, 'لا يمكن حذف مجموعة تحتوي على أصناف', req.url);
  groups.splice(groups.indexOf(group), 1);
  return ok(null);
}

function validGroup(p: ItemGroupPayload, url: string, selfId?: string): ItemGroupPayload {
  const name = p.name?.trim();
  if (!name) throw fail(422, 'اسم المجموعة مطلوب', url);
  if (groups.some((g) => g.name === name && g.id !== selfId)) throw fail(409, 'يوجد مجموعة بنفس الاسم', url);
  return { ...p, name, parentId: p.parentId || null };
}

// ── helpers ──

function findOr404<T extends { id: string }>(rows: T[], id: string | undefined, url: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw fail(404, 'العنصر غير موجود', url);
  return row;
}

/** Read-only view for other mock modules (orders, reports). */
export function itemsSnapshot(): readonly Item[] {
  return items;
}

const ITEM_BY_ID = 'items/:id';
const GROUP_BY_ID = 'item-groups/:id';

export const ITEMS_MOCK_ROUTES: MockRoute[] = [
  { method: 'GET', path: API_ENDPOINTS.items.list, protected: true, handle: listItems },
  { method: 'POST', path: API_ENDPOINTS.items.list, protected: true, handle: createItem },
  { method: 'GET', path: ITEM_BY_ID, protected: true, handle: getItem },
  { method: 'PUT', path: ITEM_BY_ID, protected: true, handle: updateItem },
  { method: 'DELETE', path: ITEM_BY_ID, protected: true, handle: deleteItem },

  // `lookup` before `:id` so it isn't captured as an id.
  { method: 'GET', path: API_ENDPOINTS.itemGroups.lookup, protected: true, handle: lookupGroups },
  { method: 'GET', path: API_ENDPOINTS.itemGroups.list, protected: true, handle: listGroups },
  { method: 'POST', path: API_ENDPOINTS.itemGroups.list, protected: true, handle: createGroup },
  { method: 'PUT', path: GROUP_BY_ID, protected: true, handle: updateGroup },
  { method: 'DELETE', path: GROUP_BY_ID, protected: true, handle: deleteGroup },
];
