import { PartyOption } from '../../parties/models/party.model';
import { ItemLookup } from '../../warehouses/models/stock.model';

/** One line of the terminal's cart. */
export interface CartLine {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
  discountPct: number;
  /** Available qty in the till's warehouse when the line was added / refreshed. */
  available: number;
  groupColor: string;
}

/** A cart parked with "تعليق" and resumed later (kept in this browser only). */
export interface HeldCart {
  id: string;
  at: string;
  customer: PartyOption | null;
  lines: CartLine[];
  discount: number;
  note: string;
}

export function toCartLine(item: ItemLookup): CartLine {
  return {
    itemId: item.id,
    code: item.code,
    name: item.name,
    unit: item.unit,
    price: item.salePrice,
    qty: 1,
    discountPct: 0,
    available: item.available,
    groupColor: item.groupColor,
  };
}
