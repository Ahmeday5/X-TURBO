/**
 * How an item is offered in the mobile store. `GET/PUT /items/{id}/store`.
 * A PUT replaces the whole record, price tiers included.
 */
export interface ItemStore {
  itemId: string;
  /** Visible in the app at all. */
  isPublished: boolean;
  /** Listed in the app's "توصيل سريع" section. */
  isFastDelivery: boolean;
  priceTiers: PriceTier[];
}

/** Volume price: from `minQty` units and up, each unit costs `unitPrice`. */
export interface PriceTier {
  minQty: number;
  unitPrice: number;
}

export type ItemStorePayload = Omit<ItemStore, 'itemId'>;

/** A single unit always sells at the item's base sale price, so tiers start at 2. */
export const MIN_TIER_QTY = 2;

/** One row of the "price in the app" preview. */
export interface PriceBand {
  /** "1 – 4" / "10 فأكثر". */
  range: string;
  unitPrice: number;
  /** Saving vs the base price, %, rounded to 1 decimal (0 for the base band). */
  savingPct: number;
}

/**
 * Cross-tier problems (duplicates, prices not falling with quantity), keyed
 * by the tier's index in `tiers`. Tiers with incomplete values are skipped —
 * their own field errors cover them.
 */
export function tierIssues(
  tiers: readonly { minQty?: number | null; unitPrice?: number | null }[],
  basePrice: number,
): Map<number, string> {
  const issues = new Map<number, string>();
  const valid = tiers
    .map((t, index) => ({ index, minQty: Number(t.minQty), unitPrice: Number(t.unitPrice) }))
    .filter((t) => Number.isInteger(t.minQty) && t.minQty >= MIN_TIER_QTY && t.unitPrice > 0);

  // Duplicate quantities: flag every repeat after the first.
  const seen = new Map<number, number>();
  for (const t of valid) {
    const first = seen.get(t.minQty);
    if (first !== undefined) issues.set(t.index, `الكمية ${t.minQty} مكررة في شريحة أخرى — كل شريحة تبدأ من كمية مختلفة`);
    else seen.set(t.minQty, t.index);
  }

  // Price must fall as quantity rises — starting below the base price.
  const sorted = valid.filter((t) => !issues.has(t.index)).sort((a, b) => a.minQty - b.minQty);
  let prev = { label: `سعر البيع الأساسي`, price: basePrice };
  for (const t of sorted) {
    if (basePrice > 0 && t.unitPrice >= prev.price) {
      issues.set(
        t.index,
        `سعر شريحة ${t.minQty} قطع (${t.unitPrice}) يجب أن يكون أقل من ${prev.label} (${prev.price}) — كلما زادت الكمية قلّ السعر`,
      );
    }
    prev = { label: `شريحة ${t.minQty} قطع`, price: t.unitPrice };
  }
  return issues;
}

/** Quantity bands as the customer sees them, starting with the base price. */
export function priceBands(tiers: readonly PriceTier[], basePrice: number): PriceBand[] {
  const sorted = [...tiers].filter((t) => t.minQty >= MIN_TIER_QTY && t.unitPrice > 0).sort((a, b) => a.minQty - b.minQty);
  const starts = [{ minQty: 1, unitPrice: basePrice }, ...sorted];
  return starts.map((t, i) => {
    const next = starts[i + 1];
    const range = next ? (next.minQty - 1 === t.minQty ? `${t.minQty}` : `${t.minQty} – ${next.minQty - 1}`) : `${t.minQty} فأكثر`;
    const savingPct = basePrice > 0 && i > 0 ? Math.round(((basePrice - t.unitPrice) / basePrice) * 1000) / 10 : 0;
    return { range, unitPrice: t.unitPrice, savingPct };
  });
}
