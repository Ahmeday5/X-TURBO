import { filter, last, map, Observable, OperatorFunction } from 'rxjs';
import { UploadEvent } from '../../core/services/api.service';

/**
 * Rules of the server's single-image uploads (car-make logos, group images,
 * item images): JPG / PNG / WEBP up to 5 MB. Checked in the browser before
 * sending; the server enforces the same rules (422 codes below).
 */
export interface ImageUploadRules {
  /** Accepted MIME types. */
  types: readonly string[];
  /** `accept` attribute of the file input (extensions too — some OSes report no MIME type). */
  accept: string;
  maxBytes: number;
}

export const STANDARD_IMAGE_RULES: ImageUploadRules = {
  types: ['image/jpeg', 'image/png', 'image/webp'],
  accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
  maxBytes: 5 * 1024 * 1024,
};

/** 422 codes of the image upload endpoints — show the server's `message`, it's ready Arabic. */
export const IMAGE_ERROR_CODES = {
  required: 'IMAGE_REQUIRED',
  typeNotAllowed: 'IMAGE_TYPE_NOT_ALLOWED',
  tooLarge: 'IMAGE_TOO_LARGE',
} as const;

const EXTENSION_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** "5 ميجا" · "1.3 ميجا" · "820 ك.ب". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
  const mb = bytes / 1024 / 1024;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} ميجا`;
}

/** File type, falling back to the extension when the browser reports none. */
function mimeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[ext] ?? '';
}

/**
 * Why `file` can't be uploaded (what's wrong + what's expected), or `null` when it's fine.
 * Mirrors the server's `IMAGE_TYPE_NOT_ALLOWED` / `IMAGE_TOO_LARGE`.
 */
export function imageFileProblem(file: File, rules: ImageUploadRules = STANDARD_IMAGE_RULES): string | null {
  if (!rules.types.includes(mimeOf(file))) {
    return `نوع الملف «${file.name}» غير مدعوم — اختر صورة JPG أو PNG أو WEBP`;
  }
  if (file.size > rules.maxBytes) {
    return `حجم الصورة ${formatFileSize(file.size)} أكبر من الحد المسموح (${formatFileSize(rules.maxBytes)}) — صغّر الصورة أو اختر غيرها`;
  }
  return null;
}

/** Keeps only the final value of `ApiService.upload` (drops the progress events). */
export function uploadResult<T>(): OperatorFunction<UploadEvent<T>, T> {
  return (source: Observable<UploadEvent<T>>) =>
    source.pipe(
      filter((e): e is Extract<UploadEvent<T>, { kind: 'done' }> => e.kind === 'done'),
      last(),
      map((e) => e.value),
    );
}
