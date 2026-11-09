import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { passwordIssues } from '../models/user.model';

/**
 * Enforces PASSWORD_RULES. The error payload is a ready Arabic message, so
 * `<app-form-error>` shows it as-is.
 */
export function passwordPolicyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value as string | null) ?? '';
    if (!value) return null;
    const issues = passwordIssues(value);
    return issues.length ? { passwordPolicy: `كلمة المرور تحتاج: ${issues.join('، ')}` } : null;
  };
}

/**
 * For a "confirm" control: must equal its sibling `password`. Re-run it when
 * the password changes (`confirm.updateValueAndValidity()`).
 */
export function sameAsPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value ?? '';
    const pw = control.parent?.get('password')?.value ?? '';
    return value && value !== pw ? { mismatch: 'كلمتا المرور غير متطابقتين' } : null;
  };
}
