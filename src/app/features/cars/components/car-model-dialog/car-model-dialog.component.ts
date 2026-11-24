import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
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
import { CarMake, CarModel, CarModelPayload, maxModelYear, MIN_MODEL_YEAR } from '../../models/car.model';
import { CarCatalogService } from '../../services/car-catalog.service';

/** `yearTo` (optional) must not precede `yearFrom`. Error lands on `yearTo`. */
function yearRangeValidator(group: AbstractControl): ValidationErrors | null {
  const from = Number(group.get('yearFrom')?.value);
  const rawTo = group.get('yearTo')?.value;
  const toCtrl = group.get('yearTo');
  if (!toCtrl) return null;
  const invalid = rawTo !== null && rawTo !== '' && Number(rawTo) < from;
  const { range, ...rest } = toCtrl.errors ?? {};
  if (invalid) toCtrl.setErrors({ ...rest, range: 'سنة النهاية قبل سنة البداية' });
  else if (range) toCtrl.setErrors(Object.keys(rest).length ? rest : null);
  return null;
}

/** Where a save is: the model itself, then its photo (the photo endpoints need the model's id). */
type SavePhase = 'idle' | 'model' | 'image';

/** Outcome of the photo step. A failure never undoes the saved model. */
interface ImageOutcome {
  model: CarModel;
  /** Server message when the photo upload / removal failed, else `null`. */
  imageError: string | null;
  imageAction: 'upload' | 'remove' | null;
}

/**
 * Create / edit a car model, with its car photo. `model` null → create under `defaultMakeId`.
 *
 * Save order: POST / PUT the model → then upload (or delete) the photo with the
 * model's id. If the photo step fails the model IS saved: the dialog closes and
 * reports it — it never re-POSTs (that would answer `DUPLICATE_NAME`); the
 * photo can be retried from "edit". `saved` always carries the latest server response.
 */
@Component({
  selector: 'app-car-model-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent, ImagePickerComponent],
  template: `
    <app-modal [open]="open()" [title]="isEdit() ? 'تعديل الموديل' : 'موديل جديد'" size="sm" (closed)="close()">
      <form id="car-model-form" class="cd" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="cmd-logo">
          <app-image-picker label="صورة العربية" fit="cover" removeLabel="إزالة الصورة" [src]="photo.src()" [disabled]="saving()"
            hint="صورة عرضية للعربية من الجنب تظهر أفضل في التطبيق — JPG أو PNG أو WEBP حتى 5 ميجا." (picked)="photo.pick($event)"
            (removed)="photo.remove()" />

          @if (removalPending()) {
          <p class="cmd-logo__note" role="status">
            <app-icon name="alert" [size]="13" /> ستُحذف الصورة الحالية عند الحفظ.
            <button type="button" class="cmd-logo__undo" [disabled]="saving()" (click)="photo.reset()">تراجع</button>
          </p>
          } @else if (photo.change()?.kind === 'upload') {
          <p class="cmd-logo__note cmd-logo__note--info" role="status">
            <app-icon name="upload" [size]="13" /> تُرفع الصورة الجديدة بعد حفظ الموديل.
          </p>
          }
        </div>

        <label class="ui-field">
          <span class="ui-label is-required">الماركة</span>
          <select class="ui-input" formControlName="makeId">
            <option value="" disabled>اختر الماركة</option>
            @for (m of makes(); track m.id) {<option [value]="m.id">{{ m.name }}</option>}
          </select>
          <app-form-error [control]="form.controls.makeId" label="الماركة" />
        </label>
        <label class="ui-field">
          <span class="ui-label is-required">اسم الموديل</span>
          <input class="ui-input" formControlName="name" placeholder="مثال: كورولا" />
          <app-form-error [control]="form.controls.name" label="اسم الموديل" />
        </label>
        <label class="ui-field">
          <span class="ui-label">الاسم بالإنجليزي</span>
          <input class="ui-input ltr" formControlName="nameEn" placeholder="Corolla" />
          <app-form-error [control]="form.controls.nameEn" label="الاسم بالإنجليزي" />
        </label>
        <div class="cd__years">
          <label class="ui-field">
            <span class="ui-label is-required">من سنة</span>
            <input class="ui-input ltr" type="number" [min]="minYear" [max]="maxYear" step="1" formControlName="yearFrom" />
            <app-form-error [control]="form.controls.yearFrom" label="سنة البداية" />
          </label>
          <label class="ui-field">
            <span class="ui-label">إلى سنة</span>
            <input class="ui-input ltr" type="number" [min]="minYear" [max]="maxYear" step="1" formControlName="yearTo"
              placeholder="حتى الآن" />
            <app-form-error [control]="form.controls.yearTo" label="سنة النهاية" />
          </label>
        </div>
        <span class="ui-hint">اترك «إلى سنة» فارغة لو الموديل لسه بيتصنّع.</span>
        <label class="ui-switch">
          <input type="checkbox" formControlName="isActive" />
          <span class="ui-switch__track"></span>
          {{ form.controls.isActive.value ? 'موديل نشط' : 'موقوف — مخفي من التطبيق' }}
        </label>
      </form>

      <div modal-footer class="cd__footer">
        <button type="button" class="ui-btn ui-btn--ghost" [disabled]="saving()" (click)="close()">إلغاء</button>
        <button type="submit" form="car-model-form" class="ui-btn ui-btn--primary" [disabled]="saving()" [attr.aria-busy]="saving()">
          @if (saving()) {<span class="cmd-spinner" aria-hidden="true"></span>} @else {<app-icon name="check" [size]="16" />}
          {{ submitLabel() }}
        </button>
      </div>
    </app-modal>
  `,
  styleUrl: '../car-dialog.shared.scss',
})
export class CarModelDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(CarCatalogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly model = input<CarModel | null>(null);
  readonly makes = input<readonly CarMake[]>([]);
  readonly defaultMakeId = input<string | null>(null);

  readonly closed = output<void>();
  readonly saved = output<CarModel>();

  protected readonly minYear = MIN_MODEL_YEAR;
  protected readonly maxYear = maxModelYear();
  protected readonly phase = signal<SavePhase>('idle');
  protected readonly saving = computed(() => this.phase() !== 'idle');
  /** Upload progress (0–100), `null` while unknown. */
  protected readonly uploadPercent = signal<number | null>(null);
  protected readonly isEdit = computed(() => !!this.model());

  /** Photo picked / removed in the form — applied after the model is saved. */
  protected readonly photo = new PendingImage(computed(() => this.model()?.imageUrl ?? null));
  protected readonly removalPending = computed(() => this.photo.change()?.kind === 'remove');

  protected readonly submitLabel = computed(() => {
    switch (this.phase()) {
      case 'model':
        return 'جارٍ الحفظ…';
      case 'image': {
        const p = this.uploadPercent();
        return this.photo.change()?.kind === 'remove' ? 'جارٍ حذف الصورة…' : `جارٍ رفع الصورة${p !== null ? ` ${p}%` : '…'}`;
      }
      default:
        return this.isEdit() ? 'حفظ التعديلات' : 'إضافة الموديل';
    }
  });

  protected readonly form = this.fb.group(
    {
      makeId: ['', Validators.required],
      name: ['', [Validators.required, Validators.maxLength(60)]],
      nameEn: ['', Validators.maxLength(60)],
      yearFrom: [this.maxYear - 1, [Validators.required, Validators.min(MIN_MODEL_YEAR), Validators.max(this.maxYear)]],
      yearTo: this.fb.control<number | null>(null, [Validators.min(MIN_MODEL_YEAR), Validators.max(this.maxYear)]),
      isActive: [true],
    },
    { validators: yearRangeValidator },
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const m = this.model();
      const makeId = this.defaultMakeId() ?? '';
      untracked(() => {
        this.photo.reset();
        this.uploadPercent.set(null);
        this.form.reset(
          m
            ? { makeId: m.makeId, name: m.name, nameEn: m.nameEn ?? '', yearFrom: m.yearFrom, yearTo: m.yearTo, isActive: m.isActive }
            : { makeId, name: '', nameEn: '', yearFrom: this.maxYear - 1, yearTo: null, isActive: true },
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
    const yearTo = v.yearTo === null || String(v.yearTo) === '' ? null : Math.floor(Number(v.yearTo));
    const payload: CarModelPayload = {
      makeId: v.makeId,
      name: v.name.trim(),
      nameEn: v.nameEn.trim() || null,
      yearFrom: Math.floor(Number(v.yearFrom)),
      yearTo,
      isActive: v.isActive,
    };
    const id = this.model()?.id;
    this.phase.set('model');
    (id ? this.api.updateModel(id, payload) : this.api.createModel(payload))
      .pipe(
        // From here on the model exists: whatever happens to the photo, it must not be saved again.
        switchMap((model) => this.applyImage(model)),
        finalize(() => this.phase.set('idle')),
      )
      .subscribe({
        next: (outcome) => this.finish(outcome, !id),
        // Only the model request can land here (the photo step never errors) → 422 under the fields.
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }

  /** Runs the pending photo change for the saved model. Never errors — a failure is reported in the outcome. */
  private applyImage(model: CarModel): Observable<ImageOutcome> {
    const change = this.photo.change();
    if (!change) return of({ model, imageError: null, imageAction: null });

    this.phase.set('image');
    this.uploadPercent.set(null);
    const action = change.kind;
    const request$: Observable<CarModel> =
      change.kind === 'upload'
        ? this.api.uploadModelImage(model.id, change.file).pipe(
            tap((e) => {
              if (e.kind === 'progress') this.uploadPercent.set(e.percent);
            }),
            uploadResult(),
          )
        : this.api.deleteModelImage(model.id);

    return request$.pipe(
      map((updated): ImageOutcome => ({ model: updated, imageError: null, imageAction: action })),
      catchError((err: ApiError) =>
        of<ImageOutcome>({
          model,
          imageError: apiErrorToMessage(err, action === 'upload' ? 'تعذّر رفع الصورة' : 'تعذّر حذف الصورة'),
          imageAction: action,
        }),
      ),
    );
  }

  private finish({ model, imageError, imageAction }: ImageOutcome, created: boolean): void {
    if (imageError) {
      const saved = created ? 'تم حفظ الموديل' : 'تم حفظ التعديلات';
      const failed = imageAction === 'remove' ? 'فشل حذف الصورة' : 'فشل رفع الصورة';
      this.toast.warning(`${saved}، لكن ${failed}: ${imageError} — يمكنك المحاولة مرة أخرى من «تعديل».`);
    } else {
      this.toast.success(created ? `تمت إضافة ${model.name}` : `تم تحديث ${model.name}`);
    }
    this.photo.reset();
    this.saved.emit(model);
  }
}
