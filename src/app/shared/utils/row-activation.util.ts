const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [contenteditable="true"]';

/**
 * Whether a click / Enter on a whole row (or card) should open its details.
 * False when it landed on something interactive inside the row (its own action
 * buttons, links, inputs), or when the user was selecting text to copy.
 */
export function shouldActivateRow(event: Event): boolean {
  const host = event.currentTarget as HTMLElement | null;
  const target = event.target as HTMLElement | null;
  const interactive = target?.closest(INTERACTIVE);
  if (interactive && interactive !== host && host?.contains(interactive)) return false;
  if (event.type === 'click' && window.getSelection()?.toString()) return false;
  return true;
}
