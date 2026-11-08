/**
 * Arabic-aware text matching for client-side search.
 *
 * Folding makes common spelling variants equal — أ/إ/آ/ٱ → ا, ة → ه, ى → ي,
 * ؤ → و, ئ → ي — drops tashkeel and tatweel (ـ), and lower-cases Latin text.
 * So "اعدادات" finds "إعدادات" and "مـبـيـعـات" finds "مبيعات".
 */

/** Tashkeel, superscript alef and tatweel: ignored entirely. */
const IGNORED = /[ً-ٰٟـ]/;

const FOLD: Readonly<Record<string, string>> = {
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ٱ': 'ا',
  'ة': 'ه',
  'ى': 'ي',
  'ؤ': 'و',
  'ئ': 'ي',
};

export interface TextSegment {
  text: string;
  hit: boolean;
}

interface Folded {
  /** The folded string. */
  value: string;
  /** `index[i]` is the position in the source of folded character `i`. */
  index: number[];
}

function fold(text: string): Folded {
  let value = '';
  const index: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (IGNORED.test(ch)) continue;
    const mapped = FOLD[ch] ?? ch.toLowerCase();
    // Keep the 1:1 mapping intact for the rare char whose lower-case form grows.
    value += mapped.length === 1 ? mapped : ch;
    index.push(i);
  }
  return { value, index };
}

export function normalizeArabic(text: string): string {
  return fold(text).value;
}

/** Splits a query into folded, non-empty words. */
export function tokenize(query: string): string[] {
  return normalizeArabic(query).split(/\s+/).filter(Boolean);
}

/** True when every token appears in at least one of the texts. */
export function matchesAll(texts: ReadonlyArray<string | undefined>, tokens: readonly string[]): boolean {
  if (!tokens.length) return true;
  const haystack = texts.filter(Boolean).map((t) => normalizeArabic(t!)).join(' ');
  return tokens.every((token) => haystack.includes(token));
}

/**
 * Splits `text` into plain and matching segments for every query token, so a
 * template can render matches with `<mark>` without touching innerHTML.
 */
export function highlightSegments(text: string, query: string): TextSegment[] {
  const tokens = tokenize(query);
  if (!text || !tokens.length) return [{ text, hit: false }];

  const { value, index } = fold(text);
  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    for (let at = value.indexOf(token); at !== -1; at = value.indexOf(token, at + token.length)) {
      ranges.push([index[at], index[at + token.length - 1] + 1]);
    }
  }
  if (!ranges.length) return [{ text, hit: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), hit: false });
    segments.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}
