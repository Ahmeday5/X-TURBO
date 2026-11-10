import { AbstractControl } from '@angular/forms';
import { ApiError, ApiFieldErrors } from '../models/api-response.model';

/**
 * Turns an `ApiError` (already normalized by `errorInterceptor`) into a
 * user-facing message. Prefers backend field errors when present so the
 * user sees the actual rule that failed instead of a generic fallback.
 *
 * Usage:
 *
 *   error: (err: ApiError) =>
 *     this.toast.error(apiErrorToMessage(err, 'تعذر حفظ البيانات')),
 *
 * - Field errors take precedence — they're the most actionable.
 * - Falls back to `err.message` (set by the interceptor from
 *   `body.message || body.error || body.detail || body.title`).
 * - Falls back to the caller's fallback only when both are missing
 *   (e.g. a `0` status with no usable hint).
 *
 * The UI is Arabic-only: if the backend ever returns English messages, map
 * them here rather than scattering translations through feature code.
 */
export function apiErrorToMessage(
  err: ApiError | undefined | null,
  fallback: string,
): string {
  if (!err) return fallback;

  const fieldMessage = formatFieldErrors(err.fieldErrors);
  if (fieldMessage) return fieldMessage;

  return err.message?.trim() || fallback;
}

/**
 * Pushes a 422's field errors onto the matching FormControls so each message
 * shows under its own input (via `<app-form-error>`, which renders string
 * error payloads verbatim).
 *
 *   error: (err: ApiError) => {
 *     const rest = applyServerErrors(this.form, err);
 *     if (rest) this.toast.error(rest);
 *   }
 *
 * - Keys are camelCase paths: `name`, `lines[0].qty`, `address.city`.
 * - `aliases` maps a server key to a different control path when the form
 *   doesn't mirror the DTO (`{ customerIds: 'recipients' }`).
 * - Errors on controls are set as `{ server: '<message>' }` and clear on the
 *   next edit (Angular re-runs validators on value change).
 *
 * @returns the messages that matched no control (joined), or `null` — show
 *   these in a toast / banner so nothing is silently dropped.
 */
export function applyServerErrors(
  form: AbstractControl,
  err: ApiError | null | undefined,
  aliases: Readonly<Record<string, string>> = {},
): string | null {
  const fieldErrors = err?.fieldErrors;
  if (!fieldErrors) return null;

  const unmatched: string[] = [];
  for (const [key, value] of Object.entries(fieldErrors)) {
    const messages = (Array.isArray(value) ? value : [value]).filter(
      (m): m is string => typeof m === 'string' && m.trim().length > 0,
    );
    if (messages.length === 0) continue;

    const control = form.get(toControlPath(aliases[key] ?? key));
    if (control && control !== form) {
      control.setErrors({ ...(control.errors ?? {}), server: messages[0] });
      control.markAsTouched();
    } else {
      unmatched.push(...messages);
    }
  }
  return unmatched.length ? unmatched.join('، ') : null;
}

/** Field → first message, for one row of an indexed collection. */
export type RowErrors = Readonly<Record<string, string>>;

/**
 * Splits indexed 422 errors (`lines[2].qty`) from the rest, for collections
 * held outside Reactive Forms (e.g. a signal of editor rows).
 *
 *   const { rows, rest } = splitIndexedErrors(err.fieldErrors, 'lines');
 *   rows.get(2)?.['qty']  // → message for the 3rd line's qty
 *
 * Keys are matched case-insensitively on the collection name and field names
 * are normalized to camelCase. `rest` keeps every other key untouched so it
 * can go through `applyServerErrors` for the header form.
 */
export function splitIndexedErrors(
  fieldErrors: ApiError['fieldErrors'],
  collection: string,
): { rows: ReadonlyMap<number, RowErrors>; rest: ApiFieldErrors | undefined } {
  if (!fieldErrors) return { rows: new Map(), rest: undefined };

  const pattern = new RegExp(`^${collection}\\[(\\d+)\\]\\.(\\w+)$`, 'i');
  const rows = new Map<number, Record<string, string>>();
  const rest: ApiFieldErrors = {};

  for (const [key, value] of Object.entries(fieldErrors)) {
    const match = pattern.exec(key);
    const message = (Array.isArray(value) ? value : [value]).find(
      (m): m is string => typeof m === 'string' && m.trim().length > 0,
    );
    if (!match || !message) {
      rest[key] = value;
      continue;
    }
    const index = Number(match[1]);
    const field = match[2].charAt(0).toLowerCase() + match[2].slice(1);
    const row = rows.get(index) ?? {};
    row[field] ??= message;
    rows.set(index, row);
  }
  return { rows, rest: Object.keys(rest).length ? rest : undefined };
}

/** Arabic wait duration: "30 ثانية" / "دقيقة" / "دقيقتين" / "5 دقائق" / "15 دقيقة". */
export function waitText(seconds: number | undefined, defaultSec: number): string {
  const s = seconds ?? defaultSec;
  if (s < 60) return `${Math.max(1, s)} ثانية`;
  const m = Math.ceil(s / 60);
  return m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : m <= 10 ? `${m} دقائق` : `${m} دقيقة`;
}

/** `lines[0].qty` → `['lines', 0, 'qty']` (also tolerates `Lines[0].Qty`). */
function toControlPath(key: string): (string | number)[] {
  return key
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg.charAt(0).toLowerCase() + seg.slice(1)));
}

/**
 * Flattens `{ field: string[] | string }` validation errors into a single
 * human-readable line. Returns null when there are no field errors so the
 * caller can fall through to the message/fallback chain.
 */
function formatFieldErrors(
  fieldErrors: ApiError['fieldErrors'],
): string | null {
  if (!fieldErrors) return null;
  const parts: string[] = [];
  for (const value of Object.values(fieldErrors)) {
    if (Array.isArray(value)) parts.push(...value.filter(Boolean));
    else if (typeof value === 'string' && value.trim()) parts.push(value);
  }
  if (parts.length === 0) return null;
  return parts.join('، ');
}
