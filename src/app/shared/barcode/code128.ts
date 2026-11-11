/**
 * Code 128 encoder (pure, no DOM). Every handheld / POS scanner reads it, it
 * encodes letters + digits (item codes like `ITM-0042`, document numbers like
 * `PUR-00012`) and packs long digit runs at double density (code set C), so
 * 13-digit product barcodes stay short enough for small shelf labels.
 *
 * Output is the module widths of the symbol: bar, space, bar, space… (1–4 each).
 */

/** Widths (bar/space/…) of symbol values 0–106; 106 is STOP (7 elements). */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
] as const;

const START_B = 104;
const START_C = 105;
const TO_B = 100; // "Code B" switch, from set C
const STOP = 106;

/** Printable ASCII only (set B). Arabic or control characters can't be encoded. */
const PRINTABLE = /^[\x20-\x7E]+$/;
const DIGITS = /^\d+$/;

export const isEncodable = (value: string): boolean => !!value && PRINTABLE.test(value);

/** Symbol values (start … data … checksum, without STOP), or `null` if not encodable. */
function symbolValues(value: string): number[] | null {
  if (!isEncodable(value)) return null;

  const codes: number[] = [];
  if (DIGITS.test(value) && value.length >= 4) {
    // Set C: two digits per symbol; an odd trailing digit switches to set B.
    codes.push(START_C);
    const even = value.length - (value.length % 2);
    for (let i = 0; i < even; i += 2) codes.push(Number(value.slice(i, i + 2)));
    if (even < value.length) codes.push(TO_B, value.charCodeAt(even) - 32);
  } else {
    codes.push(START_B);
    for (const ch of value) codes.push(ch.charCodeAt(0) - 32);
  }

  const checksum = codes.reduce((sum, code, i) => sum + code * (i === 0 ? 1 : i), 0) % 103;
  codes.push(checksum);
  return codes;
}

/** Module widths of the whole symbol (start → stop), alternating bar/space, starting with a bar. */
export function encodeCode128(value: string): number[] | null {
  const codes = symbolValues(value);
  if (!codes) return null;
  return [...codes, STOP].flatMap((code) => [...PATTERNS[code]].map(Number));
}

export interface BarcodeBar {
  /** Offset in modules from the symbol's left edge (quiet zone included). */
  x: number;
  width: number;
}

export interface BarcodeGeometry {
  bars: BarcodeBar[];
  /** Total width in modules, including both quiet zones. */
  modules: number;
}

/** Recommended quiet zone: 10 modules on each side. */
export const QUIET_ZONE = 10;

/** Bars ready to draw (`<rect>` per bar), or `null` if the value can't be encoded. */
export function barcodeGeometry(value: string): BarcodeGeometry | null {
  const widths = encodeCode128(value);
  if (!widths) return null;
  const bars: BarcodeBar[] = [];
  let x = QUIET_ZONE;
  widths.forEach((width, i) => {
    if (i % 2 === 0) bars.push({ x, width });
    x += width;
  });
  return { bars, modules: x + QUIET_ZONE };
}

/**
 * Standalone SVG markup — for print windows built as HTML strings. Scales to
 * its container (`width: 100%`), crisp at any printer resolution.
 */
export function barcodeSvg(value: string, height = 40): string | null {
  const geo = barcodeGeometry(value);
  if (!geo) return null;
  const rects = geo.bars.map((b) => `<rect x="${b.x}" y="0" width="${b.width}" height="${height}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geo.modules} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000" role="img" aria-label="${escapeAttr(value)}">${rects}</svg>`;
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
