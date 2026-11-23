import { computed, DestroyRef, inject, Signal, signal } from '@angular/core';

/** An image change chosen in a form, applied only after the entity itself is saved. */
export type PendingImageChange = { kind: 'upload'; file: File; previewUrl: string } | { kind: 'remove' } | null;

/**
 * State of a form's single image (logo, group image…) between "picked" and
 * "saved". Upload endpoints need the entity's id, so the change is kept here
 * and applied after the create / update succeeds.
 *
 * Owns the preview object URL: revoked on replace, on reset and when the
 * owner is destroyed. Call in an injection context.
 *
 *   readonly logo = new PendingImage(computed(() => this.make()?.logoUrl ?? null));
 *   <img [src]="logo.src()" />  ·  logo.pick(file)  ·  logo.remove()  ·  logo.change()
 */
export class PendingImage {
  private readonly pending = signal<PendingImageChange>(null);

  /** What to upload / delete on save (`null` = leave the saved image as it is). */
  readonly change = this.pending.asReadonly();

  /** What the preview shows: the picked file, nothing (removal pending), or the saved image. */
  readonly src: Signal<string | null>;

  /** There is a saved image or a picked one — offer "remove". */
  readonly hasImage: Signal<boolean>;

  constructor(private readonly saved: Signal<string | null>) {
    this.src = computed(() => {
      const change = this.pending();
      if (change?.kind === 'upload') return change.previewUrl;
      if (change?.kind === 'remove') return null;
      return this.saved();
    });
    this.hasImage = computed(() => !!this.src());
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  /** Use `file` on save (validate it first — see `imageFileProblem`). */
  pick(file: File): void {
    this.revoke();
    this.pending.set({ kind: 'upload', file, previewUrl: URL.createObjectURL(file) });
  }

  /** Drop the picked file; delete the saved image on save when there is one. */
  remove(): void {
    this.revoke();
    this.pending.set(this.saved() ? { kind: 'remove' } : null);
  }

  /** Forget any change (form reopened / saved / cancelled). */
  reset(): void {
    this.revoke();
    this.pending.set(null);
  }

  private revoke(): void {
    const change = this.pending();
    if (change?.kind === 'upload') URL.revokeObjectURL(change.previewUrl);
  }
}
