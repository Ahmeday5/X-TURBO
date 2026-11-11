/**
 * In-store barcodes for items that come without a manufacturer barcode.
 *
 * GS1 reserves EAN-13 numbers starting with `2` for restricted (in-store) use,
 * so a generated code never collides with a real product barcode. The value is
 * 13 digits with a valid EAN-13 check digit — it passes `AppValidators.barcode()`
 * and any scanner reads it back exactly.
 */
export function ean13CheckDigit(first12: string): number {
  const sum = [...first12].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function generateInternalBarcode(): string {
  const random = new Uint32Array(3);
  crypto.getRandomValues(random);
  const digits = Array.from(random, (n) => String(n % 10000).padStart(4, '0')).join('').slice(0, 11);
  const first12 = `2${digits}`;
  return `${first12}${ean13CheckDigit(first12)}`;
}

/** True for a 13-digit number whose last digit is a valid EAN-13 check digit. */
export const isValidEan13 = (value: string): boolean =>
  /^\d{13}$/.test(value) && ean13CheckDigit(value.slice(0, 12)) === Number(value[12]);
