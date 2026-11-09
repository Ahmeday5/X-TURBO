import { Item, stockLevel } from '../../features/items/models/item.model';
import { Warehouse, WarehouseType } from '../../features/warehouses/models/warehouse.model';
import { itemsSnapshot } from '../handlers/items.handlers';
import { daysAgo, seeded } from '../mock-utils';

/**
 * Warehouses + per-warehouse balances. Item totals (`item.stock`) are kept
 * equal to the sum of their warehouse balances — every stock change goes
 * through `adjustStock`, so the item directory and the stock screen agree.
 */

export type WarehouseRecord = Omit<Warehouse, 'itemsCount' | 'totalQty' | 'stockValue' | 'lowStockCount' | 'usagePct'>;

interface StockCell {
  qty: number;
  reserved: number;
  lastMovementAt: string | null;
}

interface WarehousesDb {
  warehouses: WarehouseRecord[];
  /** itemId → warehouseId → cell. */
  stock: Map<string, Map<string, StockCell>>;
  nextNo: number;
}

/** Same ids / names as the dashboard mock so both screens tell one story. */
const SEED: ReadonlyArray<[id: string, name: string, type: WarehouseType, city: string, address: string, manager: string, capacity: number]> = [
  ['wh-cai', 'المخزن الرئيسي', 'main', 'القاهرة', 'مدينة نصر — المنطقة السابعة، شارع مصطفى النحاس', 'منى عادل', 12000],
  ['wh-alx', 'مخزن الإسكندرية', 'branch', 'الإسكندرية', 'سموحة — شارع فوزي معاذ', 'كريم السيد', 6000],
  ['wh-giz', 'مخزن الجيزة', 'branch', 'الجيزة', 'الهرم — شارع العريش', 'هاني فؤاد', 5000],
  ['wh-oct', 'مخزن 6 أكتوبر', 'branch', '6 أكتوبر', 'المنطقة الصناعية الثالثة', 'سامح رأفت', 4500],
  ['wh-shw', 'صالة عرض التجمع', 'showroom', 'القاهرة الجديدة', 'التجمع الخامس — شارع التسعين الجنوبي', 'ياسمين فتحي', 1500],
];

/** Share of each item's stock held by each warehouse (rows sum to 1). */
const SPLIT = [0.46, 0.18, 0.15, 0.13, 0.08];

let state: WarehousesDb | null = null;

function db(): WarehousesDb {
  return (state ??= seed());
}

function seed(): WarehousesDb {
  const rand = seeded(5150);
  const warehouses: WarehouseRecord[] = SEED.map(([id, name, type, city, address, manager, capacity], i) => ({
    id,
    code: `WH-${String(i + 1).padStart(3, '0')}`,
    name,
    type,
    city,
    address,
    manager,
    phone: `01${[0, 1, 2, 5][i % 4]}${String(10_000_000 + Math.floor(rand() * 89_999_999)).slice(0, 8)}`,
    capacity,
    allowNegative: false,
    isDefault: i === 0,
    isActive: true,
    notes: '',
    createdAt: daysAgo(720 - i * 60),
  }));

  const stock = new Map<string, Map<string, StockCell>>();
  for (const item of itemsSnapshot()) {
    const cells = new Map<string, StockCell>();
    let left = item.stock;
    warehouses.forEach((w, i) => {
      const last = i === warehouses.length - 1;
      // Jitter the split so warehouses don't all look proportional.
      const share = last ? left : Math.min(left, Math.round(item.stock * SPLIT[i] * (0.6 + rand() * 0.8)));
      left -= share;
      cells.set(w.id, {
        qty: share,
        reserved: 0,
        lastMovementAt: share > 0 ? daysAgo(Math.floor(rand() * 60)) : null,
      });
    });
    stock.set(item.id, cells);
  }
  return { warehouses, stock, nextNo: warehouses.length + 1 };
}

// ── Warehouses ──

export function warehouseRows(): WarehouseRecord[] {
  return db().warehouses;
}

export function nextWarehouseNo(): number {
  return db().nextNo++;
}

export function defaultWarehouse(): WarehouseRecord {
  const list = db().warehouses;
  return list.find((w) => w.isDefault && w.isActive) ?? list.find((w) => w.isActive) ?? list[0];
}

/** Adds server-computed totals. */
export function withWarehouseStats(w: WarehouseRecord): Warehouse {
  const items = itemsSnapshot();
  let itemsCount = 0;
  let totalQty = 0;
  let stockValue = 0;
  let lowStockCount = 0;
  for (const item of items) {
    const qty = cellOf(item.id, w.id).qty;
    if (qty > 0) itemsCount++;
    totalQty += qty;
    stockValue += qty * item.purchasePrice;
    // Per-warehouse reorder level: the item's level split across active warehouses.
    if (item.isActive && qty <= warehouseMin(item)) lowStockCount++;
  }
  return {
    ...w,
    itemsCount,
    totalQty,
    stockValue: Math.round(stockValue),
    lowStockCount,
    usagePct: w.capacity > 0 ? Math.round((totalQty / w.capacity) * 100) : 0,
  };
}

// ── Stock ──

export function cellOf(itemId: string, warehouseId: string): StockCell {
  const db_ = db();
  let cells = db_.stock.get(itemId);
  if (!cells) db_.stock.set(itemId, (cells = new Map()));
  let cell = cells.get(warehouseId);
  if (!cell) cells.set(warehouseId, (cell = { qty: 0, reserved: 0, lastMovementAt: null }));
  return cell;
}

/** Reorder level of an item in one warehouse (the item level shared across active warehouses). */
export function warehouseMin(item: Pick<Item, 'minStock'>): number {
  const active = db().warehouses.filter((w) => w.isActive).length || 1;
  return Math.ceil(item.minStock / active);
}

export function warehouseLevel(item: Pick<Item, 'minStock'>, qty: number) {
  return stockLevel({ stock: qty, minStock: warehouseMin(item) });
}

/**
 * Moves stock and keeps the item's total in sync. Positive `delta` = in.
 * Callers validate availability first (see documents.db `assertAvailable`).
 */
export function adjustStock(itemId: string, warehouseId: string, delta: number, at = new Date().toISOString()): void {
  const cell = cellOf(itemId, warehouseId);
  cell.qty += delta;
  cell.lastMovementAt = at;
  const item = itemsSnapshot().find((i) => i.id === itemId);
  if (item) item.stock += delta;
}

export function adjustReserved(itemId: string, warehouseId: string, delta: number): void {
  const cell = cellOf(itemId, warehouseId);
  cell.reserved = Math.max(0, cell.reserved + delta);
}

export function availableQty(itemId: string, warehouseId: string): number {
  const cell = cellOf(itemId, warehouseId);
  return cell.qty - cell.reserved;
}

export function totalReserved(itemId: string): number {
  let total = 0;
  for (const cell of db().stock.get(itemId)?.values() ?? []) total += cell.reserved;
  return total;
}

/** Any stock left in this warehouse (blocks deleting it). */
export function warehouseHasStock(warehouseId: string): boolean {
  for (const cells of db().stock.values()) {
    const cell = cells.get(warehouseId);
    if (cell && (cell.qty !== 0 || cell.reserved !== 0)) return true;
  }
  return false;
}
