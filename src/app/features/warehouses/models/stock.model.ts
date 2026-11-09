import { StockLevel } from '../../items/models/item.model';

/** One item's balance in one warehouse. `id` = `${itemId}:${warehouseId}`. */
export interface StockRow {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  groupId: string;
  groupName: string;
  groupColor: string;
  unit: string;
  warehouseId: string;
  warehouseName: string;
  qty: number;
  /** Held by open reservations — not available for sale. */
  reserved: number;
  /** qty − reserved. */
  available: number;
  minStock: number;
  /** Unit cost (purchase price). */
  cost: number;
  /** qty × cost. */
  value: number;
  level: StockLevel;
  lastMovementAt: string | null;
}

/** Totals over the same filters as the stock list. */
export interface StockSummary {
  skuCount: number;
  totalQty: number;
  totalValue: number;
  lowCount: number;
  outCount: number;
}

/** A dated stock movement of one item (from posted documents). */
export interface StockMovement {
  documentId: string;
  documentNumber: string;
  /** DocKind of the source document. */
  kind: string;
  kindLabel: string;
  date: string;
  warehouseId: string;
  warehouseName: string;
  /** Signed: + in, − out. */
  qty: number;
  partyName: string | null;
}

/** `GET stock/items/:itemId` — one item across every warehouse. */
export interface ItemStockDetails {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  minStock: number;
  cost: number;
  totalQty: number;
  balances: Array<Pick<StockRow, 'warehouseId' | 'warehouseName' | 'qty' | 'reserved' | 'available' | 'level'>>;
  movements: StockMovement[];
}

/** Item row for pickers (document lines, POS). `stock` is in the requested warehouse, else total. */
export interface ItemLookup {
  id: string;
  code: string;
  name: string;
  unit: string;
  barcode: string;
  brand: string;
  groupId: string;
  groupName: string;
  groupColor: string;
  salePrice: number;
  purchasePrice: number;
  stock: number;
  /** stock − reserved in the requested warehouse. */
  available: number;
  minStock: number;
}
