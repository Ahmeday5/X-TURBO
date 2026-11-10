import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { isDevMode } from '@angular/core';

/**
 * Turns a control's errors into ONE user-facing Arabic message that says what
 * is wrong AND what is expected (limits, formats, examples).
 *
 * Use via `<app-form-error [control]="form.controls.email" label="البريد الإلكتروني" />`
 * or directly: `firstError(ctrl, 'الحقل')`.
 *
 * Precedence:
 *   1. `custom` overrides (per call site)
 *   2. `required` — an empty field never gets a "wrong format" message
 *   3. any error whose payload is already a sentence (string) — format
 *      validators (`AppValidators`), cross-field rules, server 422 messages
 *   4. Angular's built-in validators, worded with the limit and the actual value
 *
 * For formats, use `AppValidators` (shared/validators/app-validators.ts)
 * rather than `Validators.pattern`: a regex can't be explained to a user.
 */
export function firstError(
  control: AbstractControl | null | undefined,
  label: string,
  custom?: Record<string, (e: unknown) => string>,
): string | null {
  if (!control) return null;
  if (!(control.dirty || control.touched)) return null;
  if (!control.errors) return null;

  return resolveMessage(control.errors, label, custom);
}

/** Same as `firstError` but ignores touched/dirty — useful for forced display. */
export function firstErrorAlways(
  control: AbstractControl | null | undefined,
  label: string,
  custom?: Record<string, (e: unknown) => string>,
): string | null {
  if (!control?.errors) return null;
  return resolveMessage(control.errors, label, custom);
}

interface LengthError {
  requiredLength: number;
  actualLength: number;
}

function resolveMessage(
  errors: ValidationErrors,
  label: string,
  custom?: Record<string, (e: unknown) => string>,
): string {
  // 1. Call-site overrides always win.
  if (custom) {
    for (const key of Object.keys(custom)) {
      if (errors[key] !== undefined) return custom[key](errors[key]);
    }
  }

  // 2. Empty first.
  if (errors['required'] !== undefined) return `${label} مطلوب`;

  // 3. Validators that already explain themselves.
  for (const value of Object.values(errors)) {
    if (typeof value === 'string' && value.trim()) return value;
  }

  // 4. Angular built-ins.
  if (errors['minlength']) {
    const { requiredLength, actualLength } = errors['minlength'] as LengthError;
    return `${label} يجب ألا يقل عن ${requiredLength} أحرف (المكتوب ${actualLength})`;
  }
  if (errors['maxlength']) {
    const { requiredLength, actualLength } = errors['maxlength'] as LengthError;
    return `${label} يجب ألا يزيد عن ${requiredLength} حرفًا (المكتوب ${actualLength}) — اختصر ${actualLength - requiredLength} حرفًا`;
  }
  if (errors['min'] !== undefined) {
    const { min } = errors['min'] as { min: number };
    return min === 0 ? `${label} لا يقبل قيمة سالبة — أقل قيمة 0` : `${label} يجب أن يكون ${min} أو أكثر`;
  }
  if (errors['max'] !== undefined) {
    const { max } = errors['max'] as { max: number };
    return `${label} يجب ألا يزيد عن ${max}`;
  }
  if (errors['email'] !== undefined) {
    return `صيغة ${label} غير صحيحة — مثال: name@company.com`;
  }
  if (errors['mismatch'] !== undefined) {
    return `${label} غير متطابق`;
  }
  if (errors['pattern'] !== undefined) {
    if (isDevMode()) {
      // eslint-disable-next-line no-console
      console.warn(`[validation] "${label}" uses Validators.pattern — add a descriptive validator to AppValidators instead.`);
    }
    return `صيغة ${label} غير صحيحة`;
  }

  return `قيمة ${label} غير صحيحة`;
}

// ─────────────────────── cross-field validators ───────────────────────

/**
 * Cross-field validator: requires `controlName` and `matchControlName` to be
 * equal. Attach to the FormGroup (not an individual control) and read the
 * `mismatch` error off `matchControlName` — e.g.
 *
 *   this.fb.group({ password: [...], confirmPassword: [...] }, {
 *     validators: matchFieldsValidator('password', 'confirmPassword'),
 *   });
 */
export function matchFieldsValidator(
  controlName: string,
  matchControlName: string,
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const control = group.get(controlName);
    const matchControl = group.get(matchControlName);
    if (!control || !matchControl) return null;

    if (matchControl.value !== control.value) {
      matchControl.setErrors({ ...matchControl.errors, mismatch: true });
      return { mismatch: true };
    }

    if (matchControl.errors) {
      const { mismatch, ...rest } = matchControl.errors;
      matchControl.setErrors(Object.keys(rest).length ? rest : null);
    }
    return null;
  };
}
