/** Zero-width non-joiner: stops two Arabic initials from fusing into one word. */
const ZWNJ = '‌';

/**
 * Avatar initials: first letter of the first and last name parts.
 *   "أحمد حسن" → "أ‌ح" (kept as separate letters) · "Delta Motors" → "DM"
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length === 1 ? [parts[0][0]] : [parts[0][0], parts[parts.length - 1][0]];
  return letters.map((l) => l.toUpperCase()).join(ZWNJ);
}
