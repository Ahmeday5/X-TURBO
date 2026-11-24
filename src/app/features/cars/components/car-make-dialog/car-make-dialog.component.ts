import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, map, Observable, of, switchMap, tap } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { apiErrorToMessage, applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ImagePickerComponent } from '../../../../shared/components/image-picker/image-picker.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { uploadResult } from '../../../../shared/media/image-file.util';
import { PendingImage } from '../../../../shared/media/pending-image';
import { CarMake, CarMakePayload } from '../../models/car.model';
import { CarCatalogService } from '../../services/car-catalog.service';

/** Where a save is: the make itself, then its logo (the logo endpoints need the make's id). */
type SavePhase = 'idle' | 'make' | 'logo';

/** Outcome of the logo step. A failure never undoes the saved make. */
interface LogoOutcome {
  make: CarMake;
  /** Server message when the logo upload / removal failed, else `null`. */
  logoError: string | null;
  logoAction: 'upload' | 'remove' | null;
}

/**
 * Create / edit a car make, with its logo. `make` null → create (sort order
 * defaults to the end of the list).
 *
 * Save order: POST / PUT the make → then upload (or delete) the logo with the
 * make's id. If the logo step fails the make IS saved: the dialog closes and
 * reports it — it never re-POSTs (that would answer `DUPLICATE_NAME`); the
 * logo can be retried from "edit". `saved` always carries the latest server
 * response, so the list can update the row from it.
 */
@Component({
  selector: 'app-car-make-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent, ImagePickerComponent],
  templateUrl: './car-make-dialog.component.html',
  styleUrl: '../car-dialog.shared.scss',
})
export class CarMakeDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(CarCatalogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly make = input<CarMake | null>(null);
  /** Used to place a new make at the end. */
  readonly nextSortOrder = input(0);

  readonly closed = output<void>();
  readonly saved = output<CarMake>();

  protected readonly phase = signal<SavePhase>('idle');
  protected readonly saving = computed(() => this.phase() !== 'idle');
  /** Upload progress (0–100), `null` while unknown. */
  protected readonly uploadPercent = signal<number | null>(null);
  protected readonly isEdit = computed(() => !!this.make());

  /** Logo picked / removed in the form — applied after the make is saved. */
  protected readonly logo = new PendingImage(computed(() => this.make()?.logoUrl ?? null));
  protected readonly removalPending = computed(() => this.logo.change()?.kind === 'remove');

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    nameEn: ['', Validators.maxLength(60)],
    sortOrder: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
  });

  protected readonly submitLabel = computed(() => {
    switch (this.phase()) {
      case 'make':
        return 'جارٍ الحفظ…';
      case 'logo': {
        const p = this.uploadPercent();
        return this.logo.change()?.kind === 'remove' ? 'جارٍ حذف اللوجو…' : `جارٍ رفع اللوجو${p !== null ? ` ${p}%` : '…'}`;
      }
      default:
        return this.isEdit() ? 'حفظ التعديلات' : 'إضافة الماركة';
    }
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const m = this.make();
      const next = this.nextSortOrder();
      untracked(() => {
        this.logo.reset();
        this.uploadPercent.set(null);
        this.form.reset(
          m
            ? { name: m.name, nameEn: m.nameEn ?? '', sortOrder: m.sortOrder, isActive: m.isActive }
            : { name: '', nameEn: '', sortOrder: next, isActive: true },
        );
      });
    });
  }

  protected close(): void {
    // Closing mid-save would hide the outcome; the save finishes and reports itself.
    if (!this.saving()) this.closed.emit();
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: CarMakePayload = {
      name: v.name.trim(),
      nameEn: v.nameEn.trim() || null,
      sortOrder: Math.floor(Number(v.sortOrder) || 0),
      isActive: v.isActive,
    };
    const id = this.make()?.id;

    this.phase.set('make');
    (id ? this.api.updateMake(id, payload) : this.api.createMake(payload))
      .pipe(
        // From here on the make exists: whatever happens to the logo, it must not be saved again.
        switchMap((make) => this.applyLogo(make)),
        finalize(() => this.phase.set('idle')),
      )
      .subscribe({
        next: (outcome) => this.finish(outcome, !id),
        // Only the make request can land here (the logo step never errors) → 422 under the fields.
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }

  /** Runs the pending logo change for the saved make. Never errors — a failure is reported in the outcome. */
  private applyLogo(make: CarMake): Observable<LogoOutcome> {
    const change = this.logo.change();
    if (!change) return of({ make, logoError: null, logoAction: null });

    this.phase.set('logo');
    this.uploadPercent.set(null);
    const action = change.kind;
    const request$: Observable<CarMake> =
      change.kind === 'upload'
        ? this.api.uploadMakeLogo(make.id, change.file).pipe(
            tap((e) => {
              if (e.kind === 'progress') this.uploadPercent.set(e.percent);
            }),
            uploadResult(),
          )
        : this.api.deleteMakeLogo(make.id);

    return request$.pipe(
      map((updated): LogoOutcome => ({ make: updated, logoError: null, logoAction: action })),
      catchError((err: ApiError) =>
        of<LogoOutcome>({
          make,
          logoError: apiErrorToMessage(err, action === 'upload' ? 'تعذّر رفع الصورة' : 'تعذّر حذف اللوجو'),
          logoAction: action,
        }),
      ),
    );
  }

  private finish({ make, logoError, logoAction }: LogoOutcome, created: boolean): void {
    if (logoError) {
      const saved = created ? 'تم حفظ الماركة' : 'تم حفظ التعديلات';
      const failed = logoAction === 'remove' ? 'فشل حذف اللوجو' : 'فشل رفع اللوجو';
      this.toast.warning(`${saved}، لكن ${failed}: ${logoError} — يمكنك المحاولة مرة أخرى من «تعديل».`);
    } else {
      this.toast.success(created ? `تمت إضافة ${make.name}` : `تم تحديث ${make.name}`);
    }
    this.logo.reset();
    this.saved.emit(make);
  }
}
