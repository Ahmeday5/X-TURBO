import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { formatFileSize, ImageUploadRules, imageFileProblem, STANDARD_IMAGE_RULES } from '../../media/image-file.util';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

/**
 * Single-image picker: drop zone (drag & drop, click or keyboard) with a live
 * preview, "change" and "remove". Files are validated here (type / size) and
 * only valid ones are emitted — the problem is shown inline, nothing is sent.
 * It never uploads: the form decides when (usually after the entity is saved,
 * see `PendingImage`).
 *
 *   <app-image-picker label="لوجو الماركة" [src]="logo.src()" [error]="serverError()"
 *     (picked)="logo.pick($event)" (removed)="logo.remove()" />
 */
@Component({
  selector: 'app-image-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="ip" [class.has-image]="!!src()" [class.is-dragging]="dragging()" [class.is-invalid]="!!message()"
      [class.is-disabled]="disabled()">
      <div class="ip__zone" role="button" [attr.tabindex]="disabled() ? -1 : 0" [attr.aria-label]="zoneLabel()"
        [attr.aria-describedby]="hintId" [attr.aria-disabled]="disabled()"
        (click)="browse()" (keydown.enter)="browse(); $event.preventDefault()" (keydown.space)="browse(); $event.preventDefault()"
        (dragenter)="onDragOver($event)" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
        @if (src(); as url) {
          <img class="ip__preview" [class.ip__preview--contain]="fit() === 'contain'" [src]="url" [alt]="label()" />
        } @else {
          <span class="ip__empty">
            <app-icon name="upload" [size]="22" />
            <strong>اسحب الصورة هنا</strong>
            <small>أو اضغط لاختيار صورة</small>
          </span>
        }
        @if (dragging()) {<span class="ip__drop-hint"><app-icon name="upload" [size]="18" /> أفلت الصورة هنا</span>}
      </div>

      <div class="ip__side">
        <span class="ip__label">{{ label() }}</span>
        <div class="ip__actions">
          <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" [disabled]="disabled()" (click)="browse()">
            <app-icon name="image" [size]="14" /> {{ src() ? 'تغيير الصورة' : 'اختيار صورة' }}
          </button>
          @if (src() && removable()) {
            <button type="button" class="ui-btn ui-btn--danger ui-btn--sm" [disabled]="disabled()" (click)="remove()">
              <app-icon name="trash" [size]="14" /> {{ removeLabel() }}
            </button>
          }
        </div>
        @if (message(); as m) {
          <span class="ip__error" role="alert" [id]="hintId">{{ m }}</span>
        } @else {
          <span class="ui-hint" [id]="hintId">{{ hint() || defaultHint() }}</span>
        }
      </div>

      <input #file class="ip__input" type="file" tabindex="-1" aria-hidden="true" [accept]="rules().accept"
        (change)="onFileInput($event)" />
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .ip { display: flex; align-items: center; gap: 14px; }
      .ip__zone {
        position: relative; flex-shrink: 0; width: 112px; height: 112px;
        display: grid; place-items: center; overflow: hidden;
        border: 1.5px dashed var(--brd2); border-radius: var(--rl); background: var(--bg3);
        color: var(--txt3); cursor: pointer; outline: none;
        transition: border-color var(--dur-fast), background var(--dur-fast), box-shadow var(--dur);
      }
      .ip__zone:hover { border-color: var(--primary); }
      .ip__zone:focus-visible { box-shadow: var(--focus-ring); border-color: var(--primary); }
      .has-image .ip__zone { border-style: solid; border-color: var(--brd); background: var(--bg2); }
      .is-dragging .ip__zone { border-color: var(--primary); background: var(--primary-soft); }
      .is-invalid .ip__zone { border-color: var(--re); }
      .is-disabled .ip__zone { cursor: not-allowed; opacity: 0.6; }
      .ip__preview { width: 100%; height: 100%; object-fit: cover; }
      .ip__preview--contain { object-fit: contain; padding: 10px; }
      .ip__empty { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px; text-align: center; }
      .ip__empty strong { font-size: 11.5px; color: var(--txt2); }
      .ip__empty small { font-size: 10.5px; }
      .ip__drop-hint {
        position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
        background: color-mix(in srgb, var(--primary) 85%, transparent); color: #fff; font-size: 11.5px; font-weight: 700;
        pointer-events: none;
      }
      .ip__side { display: flex; flex: 1; flex-direction: column; gap: 8px; min-width: 0; }
      .ip__label { font-size: 12.5px; font-weight: 600; color: var(--txt2); }
      .ip__actions { display: flex; flex-wrap: wrap; gap: 6px; }
      .ip__error { font-size: 11.5px; line-height: 1.5; color: var(--re); }
      .ip__input { display: none; }
      @media (max-width: 420px) {
        .ip { flex-direction: column; align-items: stretch; }
        .ip__zone { width: 100%; height: 140px; }
      }
    `,
  ],
})
export class ImagePickerComponent {
  /** Field label and the image's alt text ("لوجو الماركة"). */
  readonly label = input.required<string>();
  /** Current preview (picked file's object URL or the saved image URL); `null` = empty. */
  readonly src = input<string | null>(null);
  readonly rules = input<ImageUploadRules>(STANDARD_IMAGE_RULES);
  /** Logos must never be cropped → `contain`; photos fill the box → `cover`. */
  readonly fit = input<'contain' | 'cover'>('cover');
  readonly hint = input<string>('');
  /** External error (e.g. the server's 422 message) — shown when there's no local one. */
  readonly error = input<string | null>(null);
  readonly removable = input(true);
  readonly removeLabel = input('إزالة');
  readonly disabled = input(false);

  /** A valid file the user picked. */
  readonly picked = output<File>();
  readonly removed = output<void>();

  protected readonly hintId = `image-picker-hint-${nextId++}`;
  protected readonly dragging = signal(false);
  private readonly localError = signal<string | null>(null);
  protected readonly message = computed(() => this.localError() ?? this.error());

  protected readonly defaultHint = computed(() => `صورة JPG أو PNG أو WEBP حتى ${formatFileSize(this.rules().maxBytes)}.`);
  protected readonly zoneLabel = computed(() => `${this.label()} — ${this.src() ? 'اضغط لتغيير الصورة' : 'اضغط لاختيار صورة أو اسحبها هنا'}`);

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');

  protected browse(): void {
    if (!this.disabled()) this.fileInput().nativeElement.click();
  }

  protected remove(): void {
    this.localError.set(null);
    this.removed.emit();
  }

  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same file can be picked again after removing it
    if (file) this.accept(file);
  }

  protected onDragOver(event: DragEvent): void {
    if (this.disabled() || !hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    // Moving over the zone's own children fires dragleave too — only end when the pointer really leaves.
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled()) return;
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    if (files.length > 1) {
      this.localError.set('اسحب صورة واحدة فقط');
      return;
    }
    this.accept(files[0]);
  }

  private accept(file: File): void {
    const problem = imageFileProblem(file, this.rules());
    this.localError.set(problem);
    if (!problem) this.picked.emit(file);
  }
}

const hasFiles = (event: DragEvent): boolean => !!event.dataTransfer?.types?.includes('Files');
