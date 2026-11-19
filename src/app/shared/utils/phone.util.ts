/**
 * Egyptian mobile in the local form people read and type: `+201012345678` /
 * `00201012345678` / `201012345678` → `01012345678`. Anything else is
 * returned trimmed, unchanged.
 */
export function toLocalMobile(phone: string | null | undefined): string {
  const value = (phone ?? '').replace(/[\s-]/g, '');
  const match = /^(?:\+|00)?20(1\d{9})$/.exec(value);
  return match ? `0${match[1]}` : value;
}

/** `tel:` link target that dials from any SIM (international form kept as-is). */
export function telHref(phone: string | null | undefined): string {
  return `tel:${(phone ?? '').replace(/[\s-]/g, '')}`;
}
