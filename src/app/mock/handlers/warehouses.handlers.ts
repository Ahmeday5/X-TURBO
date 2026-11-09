import { ItemLookup, ItemStockDetails, StockRow, StockSummary } from '../../features/warehouses/models/stock.model';
import { WarehouseOption, WarehousePayload, WAREHOUSE_TYPES } from '../../features/warehouses/models/warehouse.model';
import { STOCK_ENDPOINTS } from '../../features/warehouses/services/stock.service';
import { WAREHOUSES_ENDPOINTS } from '../../features/warehouses/services/warehouses.service';
import { findOr404 } from '../db/db-utils';
import { documentRows, itemMovements } from '../db/documents.db';
import {
  cellOf,
  nextWarehouseNo,
  warehouseHasStock,
  warehouseLevel,
  warehouseMin,
  warehouseRows,
  withWarehouseStats,
  WarehouseRecord,
} from '../db/warehouses.db';
import { bodyOf, CollectionOptions, filterCollection, queryCollection } from '../mock-collection';
import { fail, MockContext, MockRoute, ok } from '../mock-http';
import { itemsSnapshot } from './items.handlers';

// ── Warehouses ──

function listWarehouses({ query }: MockContext) {
  return ok(
    queryCollection(warehouseRows().map(withWarehouseStats), query, {
      searchFields: ['name', 'code', 'city', 'manager', 'address'],
      filters: {
        type: (row, v) => row.type === v,
        status: (row, v) => (v === 'active' ? row.isActive : !row.isActive),
      },
    }),
  );
}

function lookupWarehouses() {
  const options: WarehouseOption[] = warehouseRows()
    .filter((w) => w.isActive)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    .map(({ id, code, name, isDefault }) => ({ id, code, name, isDefault }));
  return ok(options);
}

function getWarehouse({ params, req }: MockContext) {
  return ok(withWarehouseStats(findOr404(warehouseRows(), params['id'], req.url, 'المخزن')));
}

function createWarehouse({ req }: MockContext) {
  const payload = validWarehouse(bodyOf<WarehousePayload>(req.body), req.url);
  const n = nextWarehouseNo();
  const row: WarehouseRecord = {
    ...payload,
    id: `wh-${n}`,
    code: `WH-${String(n).padStart(3, '0')}`,
    createdAt: new Date().toISOString(),
  };
  if (row.isDefault) clearDefault();
  warehouseRows().push(row);
  return ok(withWarehouseStats(row), 201);
}

function updateWarehouse({ params, req }: MockContext) {
  const row = findOr404(warehouseRows(), params['id'], req.url, 'المخزن');
  const payload = validWarehouse(bodyOf<WarehousePayload>(req.body), req.url, row.id);
  if (row.isDefault && !payload.isDefault) throw fail(422, 'يجب أن يكون هناك مخزن افتراضي — اجعل مخزنًا آخر افتراضيًا أولًا', req.url);
  if (row.isDefault && !payload.isActive) throw fail(422, 'لا يمكن إيقاف المخزن الافتراضي', req.url);
  if (payload.isDefault && !row.isDefault) clearDefault();
  Object.assign(row, payload);
  // Keep denormalised names in documents in sync, like the real API would.
  for (const d of documentRows()) {
    if (d.warehouseId === row.id) d.warehouseName = row.name;
    if (d.toWarehouseId === row.id) d.toWarehouseName = row.name;
  }
  return ok(withWarehouseStats(row));
}

function deleteWarehouse({ params, req }: MockContext) {
  const rows = warehouseRows();
  const row = findOr404(rows, params['id'], req.url, 'المخزن');
  if (row.isDefault) throw fail(409, 'لا يمكن حذف المخزن الافتراضي', req.url);
  if (warehouseHasStock(row.id)) throw fail(409, 'لا يمكن حذف مخزن به أرصدة — حوّل البضاعة أولًا أو أوقف المخزن', req.url);
  if (documentRows().some((d) => d.warehouseId === row.id || d.toWarehouseId === row.id)) {
    throw fail(409, 'لا يمكن حذف مخزن عليه حركات — أوقفه بدلًا من ذلك', req.url);
  }
  rows.splice(rows.indexOf(row), 1);
  return ok(null);
}

function validWarehouse(p: WarehousePayload, url: string, selfId?: string): WarehousePayload {
  const name = p.name?.trim();
  if (!name) throw fail(422, 'اسم المخزن مطلوب', url);
  if (warehouseRows().some((w) => w.name === name && w.id !== selfId)) throw fail(409, 'يوجد مخزن بنفس الاسم', url);
  if (!WAREHOUSE_TYPES.includes(p.type)) throw fail(422, 'نوع المخزن غير صحيح', url);
  if (p.isDefault && !p.isActive) throw fail(422, 'المخزن الافتراضي يجب أن يكون نشطًا', url);
  return {
    ...p,
    name,
    city: p.city?.trim() ?? '',
    address: p.address?.trim() ?? '',
    manager: p.manager?.trim() ?? '',
    phone: p.phone?.trim() ?? '',
    notes: p.notes?.trim() ?? '',
    capacity: Math.max(0, Math.round(Number(p.capacity) || 0)),
  };
}

function clearDefault(): void {
  for (const w of warehouseRows()) w.isDefault = false;
}

// ── Stock ──

function stockRows(): StockRow[] {
  const out: StockRow[] = [];
  const warehouses = warehouseRows();
  for (const item of itemsSnapshot()) {
    for (const w of warehouses) {
      const cell = cellOf(item.id, w.id);
      // Skip empty cells of inactive warehouses — noise.
      if (!w.isActive && cell.qty === 0) continue;
      out.push({
        id: `${item.id}:${w.id}`,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        groupId: item.groupId,
        groupName: item.groupName,
        groupColor: item.groupColor,
        unit: item.unit,
        warehouseId: w.id,
        warehouseName: w.name,
        qty: cell.qty,
        reserved: cell.reserved,
        available: cell.qty - cell.reserved,
        minStock: warehouseMin(item),
        cost: item.purchasePrice,
        value: Math.round(cell.qty * item.purchasePrice),
        level: warehouseLevel(item, cell.qty),
        lastMovementAt: cell.lastMovementAt,
      });
    }
  }
  return out;
}

const STOCK_OPTIONS: CollectionOptions<StockRow> = {
  searchFields: ['itemName', 'itemCode', 'groupName'],
  filters: {
    warehouseId: (row, v) => row.warehouseId === v,
    groupId: (row, v) => row.groupId === v,
    level: (row, v) => row.level === v,
    reserved: (row) => row.reserved > 0,
  },
};

function listStock({ query }: MockContext) {
  return ok(queryCollection(stockRows(), query, STOCK_OPTIONS));
}

function stockSummary({ query }: MockContext) {
  const rows = filterCollection(stockRows(), query, STOCK_OPTIONS);
  const summary: StockSummary = {
    skuCount: new Set(rows.filter((r) => r.qty > 0).map((r) => r.itemId)).size,
    totalQty: rows.reduce((s, r) => s + r.qty, 0),
    totalValue: rows.reduce((s, r) => s + r.value, 0),
    lowCount: rows.filter((r) => r.level === 'low').length,
    outCount: rows.filter((r) => r.level === 'out').length,
  };
  return ok(summary);
}

function itemStock({ params, req }: MockContext) {
  const item = findOr404(itemsSnapshot(), params['itemId'], req.url, 'الصنف');
  const details: ItemStockDetails = {
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    unit: item.unit,
    minStock: item.minStock,
    cost: item.purchasePrice,
    totalQty: item.stock,
    balances: warehouseRows()
      .filter((w) => w.isActive || cellOf(item.id, w.id).qty !== 0)
      .map((w) => {
        const cell = cellOf(item.id, w.id);
        return {
          warehouseId: w.id,
          warehouseName: w.name,
          qty: cell.qty,
          reserved: cell.reserved,
          available: cell.qty - cell.reserved,
          level: warehouseLevel(item, cell.qty),
        };
      }),
    movements: itemMovements(item.id),
  };
  return ok(details);
}

function itemLookup({ query }: MockContext) {
  const warehouseId = query.get('warehouseId');
  const rows: ItemLookup[] = itemsSnapshot()
    .filter((i) => i.isActive)
    .map((i) => {
      const cell = warehouseId ? cellOf(i.id, warehouseId) : null;
      const stock = cell ? cell.qty : i.stock;
      const reserved = cell ? cell.reserved : warehouseRows().reduce((s, w) => s + cellOf(i.id, w.id).reserved, 0);
      return {
        id: i.id,
        code: i.code,
        name: i.name,
        unit: i.unit,
        barcode: i.barcode,
        brand: i.brand,
        groupId: i.groupId,
        groupName: i.groupName,
        groupColor: i.groupColor,
        salePrice: i.salePrice,
        purchasePrice: i.purchasePrice,
        stock,
        available: stock - reserved,
        minStock: i.minStock,
      };
    });
  return ok(rows);
}


const WAREHOUSE_BY_ID = 'warehouses/:id';

export const WAREHOUSES_MOCK_ROUTES: MockRoute[] = [
  // Literal paths first so they aren't captured as `:id`.
  { method: 'GET', path: WAREHOUSES_ENDPOINTS.lookup, protected: true, handle: lookupWarehouses },
  { method: 'GET', path: WAREHOUSES_ENDPOINTS.list, protected: true, handle: listWarehouses },
  { method: 'POST', path: WAREHOUSES_ENDPOINTS.list, protected: true, handle: createWarehouse },
  { method: 'GET', path: WAREHOUSE_BY_ID, protected: true, handle: getWarehouse },
  { method: 'PUT', path: WAREHOUSE_BY_ID, protected: true, handle: updateWarehouse },
  { method: 'DELETE', path: WAREHOUSE_BY_ID, protected: true, handle: deleteWarehouse },

  { method: 'GET', path: STOCK_ENDPOINTS.summary, protected: true, handle: stockSummary },
  { method: 'GET', path: STOCK_ENDPOINTS.list, protected: true, handle: listStock },
  { method: 'GET', path: 'stock/items/:itemId', protected: true, handle: itemStock },
  // Registered before ITEMS_MOCK_ROUTES (see interceptor) so `items/:id` doesn't capture it.
  { method: 'GET', path: STOCK_ENDPOINTS.itemLookup, protected: true, handle: itemLookup },
];
