import { AbstractControl, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * The app's format validators — ONE definition per business format, used by
 * every form, so "valid" means the same thing on every screen.
 *
 * Each validator's error payload is a ready Arabic sentence that tells the
 * user (1) what is wrong with what they typed and (2) what the correct format
 * looks like, with an example:
 *
 *   «رقم الموبايل يجب أن يتكون من 11 رقمًا (المكتوب 10) — مثال: 01012345678»
 *
 * `<app-form-error>` renders string payloads verbatim. Empty values pass —
 * combine with `Validators.required` when the field is mandatory.
 *
 *   phone: ['', [Validators.required, AppValidators.mobile()]]
 */

// ── Building blocks ──

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits — common when typing on an Arabic keyboard. */
const EASTERN_DIGITS = /[٠-٩۰-۹]/;
const ARABIC_LETTERS = /[؀-ۿ]/;

/** Wraps a "what's wrong?" check into a validator keyed by `key`; skips empty values. */
function formatValidator(key: string, problem: (value: string) => string | null): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) return null;
    const message = problem(value);
    return message ? { [key]: message } : null;
  };
}

/** Common problems of a digits-only value, or null. */
function digitsProblem(value: string, subject: string): string | null {
  if (EASTERN_DIGITS.test(value)) return `اكتب ${subject} بالأرقام الإنجليزية (0-9)`;
  if (/\s/.test(value)) return `${subject} بدون مسافات`;
  if (!/^\d+$/.test(value)) return `${subject} يقبل أرقامًا فقط`;
  return null;
}

/** "11 رقمًا" / "من 8 إلى 14 رقمًا". */
function lengthText(min: number, max: number): string {
  return min === max ? `${min} رقمًا` : `من ${min} إلى ${max} رقمًا`;
}

/** A fixed- or ranged-length digits value (barcode, tax number, national ID…). */
function digitsValidator(key: string, subject: string, min: number, max: number, example: string): ValidatorFn {
  return formatValidator(key, (v) => {
    const base = digitsProblem(v, subject);
    if (base) return `${base} — مثال: ${example}`;
    if (v.length < min || v.length > max) {
      return `${subject} يتكون من ${lengthText(min, max)} (المكتوب ${v.length}) — مثال: ${example}`;
    }
    return null;
  });
}

// ── Formats ──

const MOBILE_PREFIXES = ['010', '011', '012', '015'] as const;
const MOBILE_EXAMPLE = '01012345678';

function mobileProblem(v: string, subject: string): string | null {
  const base = digitsProblem(v, subject);
  if (base) return `${base} — مثال: ${MOBILE_EXAMPLE}`;
  if (!MOBILE_PREFIXES.some((p) => v.startsWith(p))) {
    return `${subject} يبدأ بـ 010 أو 011 أو 012 أو 015 — مثال: ${MOBILE_EXAMPLE}`;
  }
  if (v.length !== 11) return `${subject} يتكون من 11 رقمًا (المكتوب ${v.length}) — مثال: ${MOBILE_EXAMPLE}`;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

export const AppValidators = {
  /** Egyptian mobile: 11 digits, 010 / 011 / 012 / 015. For people (customers, employees, users). */
  mobile(): ValidatorFn {
    return formatValidator('mobile', (v) => mobileProblem(v, 'رقم الموبايل'));
  },

  /**
   * Any Egyptian number — mobile, or landline with area code (9–10 digits,
   * e.g. 0223456789 for Cairo). For places (warehouses, the company).
   */
  phone(): ValidatorFn {
    return formatValidator('phone', (v) => {
      const subject = 'رقم التليفون';
      const example = 'مثال: 0223456789 أو 01012345678';
      const base = digitsProblem(v, subject);
      if (base) return `${base} — ${example}`;
      if (!v.startsWith('0')) return `${subject} يبدأ بـ 0 ومعه كود المحافظة أو الشبكة — ${example}`;
      if (v.startsWith('01')) return mobileProblem(v, subject);
      if (v.length < 9 || v.length > 10) {
        return `التليفون الأرضي يتكون من 9 أو 10 أرقام بكود المحافظة (المكتوب ${v.length}) — ${example}`;
      }
      return null;
    });
  },

  email(): ValidatorFn {
    return formatValidator('email', (v) => {
      const example = 'مثال: name@company.com';
      if (/\s/.test(v)) return `البريد الإلكتروني بدون مسافات — ${example}`;
      if (ARABIC_LETTERS.test(v)) return `البريد الإلكتروني يُكتب بالحروف الإنجليزية — ${example}`;
      const at = v.split('@').length - 1;
      if (at === 0) return `البريد الإلكتروني ينقصه الرمز @ — ${example}`;
      if (at > 1) return `البريد الإلكتروني يحتوي على @ واحدة فقط — ${example}`;
      if (!EMAIL.test(v)) return `البريد الإلكتروني ينقصه اسم النطاق بعد @ (مثل company.com) — ${example}`;
      return null;
    });
  },

  /** Product barcode (EAN-8 … GTIN-14): 8–14 digits. */
  barcode(): ValidatorFn {
    return digitsValidator('barcode', 'الباركود', 8, 14, '6221234567890');
  },

  /** Egyptian tax registration number: 9 digits. */
  taxNumber(): ValidatorFn {
    return digitsValidator('taxNumber', 'الرقم الضريبي', 9, 9, '123456789');
  },

  /** Egyptian national ID: 14 digits, starting with 2 (born 1900s) or 3 (born 2000s). */
  nationalId(): ValidatorFn {
    const example = '29001011234567';
    const fixed = digitsValidator('nationalId', 'الرقم القومي', 14, 14, example);
    return (control) => {
      const error = fixed(control);
      if (error) return error;
      const v = String(control.value ?? '').trim();
      return v && !/^[23]/.test(v)
        ? { nationalId: `الرقم القومي يبدأ بـ 2 (مواليد 1900–1999) أو 3 (مواليد 2000 وما بعدها) — مثال: ${example}` }
        : null;
    };
  },

  /** Document-number prefix: 1–5 capital English letters (SI, PI, RV…). */
  docPrefix(): ValidatorFn {
    return formatValidator('docPrefix', (v) => {
      const example = 'مثال: SI أو INV';
      if (ARABIC_LETTERS.test(v)) return `البادئة تُكتب بالحروف الإنجليزية — ${example}`;
      if (/[a-z]/.test(v) && /^[A-Za-z]+$/.test(v)) return `البادئة بحروف إنجليزية كبيرة (${v.toUpperCase()}) — ${example}`;
      if (!/^[A-Z]+$/.test(v)) return `البادئة حروف إنجليزية فقط، بدون أرقام أو رموز أو مسافات — ${example}`;
      if (v.length > 5) return `البادئة من 1 إلى 5 أحرف (المكتوب ${v.length}) — ${example}`;
      return null;
    });
  },

  /** Whole number (quantities): no fractions. `subject` names the field in the message. */
  wholeNumber(subject = 'القيمة'): ValidatorFn {
    return formatValidator('wholeNumber', (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return `${subject} يقبل أرقامًا فقط — مثال: 5`;
      return Number.isInteger(n) ? null : `${subject} رقم صحيح بدون كسور (المكتوب ${v}) — مثال: ${Math.max(1, Math.round(n))}`;
    });
  },

  /** Strictly greater than zero (prices, amounts). */
  positive(subject = 'القيمة'): ValidatorFn {
    return formatValidator('positive', (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return `${subject} يقبل أرقامًا فقط`;
      return n > 0 ? null : `${subject} يجب أن يكون أكبر من صفر (المكتوب ${v})`;
    });
  },

  /** ISO-4217 currency code: exactly 3 capital English letters. */
  currencyCode(): ValidatorFn {
    return formatValidator('currencyCode', (v) => {
      const example = 'مثال: USD أو EUR أو SAR';
      if (ARABIC_LETTERS.test(v)) return `كود العملة يُكتب بالحروف الإنجليزية — ${example}`;
      if (!/^[A-Za-z]+$/.test(v)) return `كود العملة حروف إنجليزية فقط — ${example}`;
      if (v.length !== 3) return `كود العملة 3 أحرف بالضبط حسب معيار ISO (المكتوب ${v.length}) — ${example}`;
      if (v !== v.toUpperCase()) return `كود العملة بحروف كبيرة (${v.toUpperCase()}) — ${example}`;
      return null;
    });
  },
} as const;

/**
 * Runs a validator on a plain value (inputs bound to signals / ngModel rather
 * than a FormControl) and returns its message, or `null` when valid.
 *
 *   readonly phoneError = computed(() => validationMessage(AppValidators.mobile(), this.phone()));
 */
export function validationMessage(validator: ValidatorFn, value: unknown): string | null {
  const errors = validator(new FormControl(value));
  if (!errors) return null;
  const first = Object.values(errors)[0];
  return typeof first === 'string' ? first : 'القيمة غير صحيحة';
}
