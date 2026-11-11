import { effect, Signal, untracked } from '@angular/core';

/**
 * Runs a row action inside its details drawer — the drawer owns the logic
 * (confirm dialogs, forms, validation, error handling), the row only asks.
 *
 * Once the drawer's record (matching the requested id) has loaded and an
 * intent is set, `done()` (the page clears it from the URL) and then
 * `run(record, intent)` are called exactly once per (record, intent) pair.
 * Pure navigations (edit, open elsewhere) should be handled by the page itself.
 * Call in an injection context (a constructor).
 */
export function runDrawerIntent<T extends { id: string }, K extends string>(
  record: Signal<T | null>,
  intent: Signal<K | null | undefined>,
  run: (record: T, intent: K) => void,
  done: () => void,
): void {
  let handled: string | null = null;
  effect(() => {
    const r = record();
    const i = intent();
    if (!r || !i) {
      if (!i) handled = null;
      return;
    }
    const key = `${r.id}:${i}`;
    if (key === handled) return;
    handled = key;
    untracked(() => {
      // Clear the request first, so a navigation the action triggers starts from a clean URL.
      done();
      run(r, i);
    });
  });
}
