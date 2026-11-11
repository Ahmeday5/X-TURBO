/** The fields a scan can hit. */
export interface Scannable {
  barcode?: string | null;
  code: string;
  sku?: string | null;
}

const norm = (v: string | null | undefined): string => (v ?? '').trim().toLowerCase();

/**
 * The item a scanned / typed code refers to — EXACT match only, barcode first,
 * then item code, then SKU. Never a prefix or a "contains" match: a scanner
 * types digit by digit, and matching while it types would grab whichever item
 * has a shorter code that happens to be a prefix (the "wrong extra item" bug).
 * Call it once the full code is in — on Enter (scanners send Enter at the end).
 */
export function findByScan<T extends Scannable>(items: readonly T[], raw: string): T | null {
  const value = norm(raw);
  if (!value) return null;
  return (
    items.find((i) => norm(i.barcode) === value) ??
    items.find((i) => norm(i.code) === value) ??
    items.find((i) => !!i.sku && norm(i.sku) === value) ??
    null
  );
}
