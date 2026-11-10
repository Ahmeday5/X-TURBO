/** An item photo shown in the mobile store. `GET /items/{id}/images`. */
export interface ItemImage {
  id: string;
  /** Absolute URL (`https://<api>/api/media/products/…`) — use as `<img src>` as-is. */
  url: string;
  contentType: string;
  /** Bytes. */
  size: number;
  sortOrder: number;
  /** The one shown on the product card in the app. */
  isPrimary: boolean;
  createdAt: string;
}

/** Upload rules — mirrored from the API so most mistakes are caught before sending. */
export const ITEM_IMAGE_RULES = {
  types: ['image/jpeg', 'image/png', 'image/webp'] as readonly string[],
  /** For the file picker's `accept`. */
  accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
  maxBytes: 5 * 1024 * 1024,
  maxPerItem: 10,
} as const;

/** Codes the item images API answers with. */
export const ITEM_IMAGE_ERROR_CODES = {
  typeNotAllowed: 'IMAGE_TYPE_NOT_ALLOWED', // 422
  tooLarge: 'IMAGE_TOO_LARGE', // 422
  required: 'IMAGE_REQUIRED', // 422
  tooMany: 'TOO_MANY_IMAGES', // 409
} as const;

/** Why a picked file would be refused, or `null` when it's fine. */
export function imageFileProblem(file: File): string | null {
  if (!ITEM_IMAGE_RULES.types.includes(file.type)) return 'النوع غير مدعوم — JPG أو PNG أو WEBP فقط';
  if (file.size > ITEM_IMAGE_RULES.maxBytes) return 'الحجم أكبر من 5 ميجا';
  return null;
}

/** 1.4 ميجا / 320 ك.ب */
export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} ميجا` : `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
}
