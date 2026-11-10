import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { formatMoney } from '../../../../shared/utils/format.util';
import { AppValidators } from '../../../../shared/validators/app-validators';
import { deliveryDaysLabel, DeliveryZone, DeliveryZonePayload } from '../../models/delivery-zone.model';
import { DeliveryZonesService } from '../../services/delivery-zones.service';

/** Longest delivery estimate the form accepts. */
const MAX_DAYS = 30;

/** Max days must not be below min days — error (a sentence) lands on `estimatedDaysMax`. */
function daysRange(group: AbstractControl): ValidationErrors | null {
  const min = group.get('estimatedDaysMin')?.value;
  const maxCtrl = group.get('estimatedDaysMax');
  if (!maxCtrl) return null;
  const max = maxCtrl.value;
  const invalid = min !== null && max !== null && min !== '' && max !== '' && Number(max) < Number(min);
  const { range, ...rest } = maxCtrl.errors ?? {};
  if (invalid) {
    maxCtrl.setErrors({ ...rest, range: `أقصى مدة (${max}) أقل من أقل مدة (${min}) — اختر ${min} يوم أو أكثر` });
  } else if (range) {
    maxCtrl.setErrors(Object.keys(rest).length ? rest : null);
  }
  return null;
}

/** Create / edit a delivery zone. `zone` null → create (optionally for `presetGovernorate`). */
@Component({
  selector: 'app-zone-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent],
  templateUrl: './zone-dialog.component.html',
  styleUrl: './zone-dialog.component.scss',
})
export class ZoneDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(DeliveryZonesService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly zone = input<DeliveryZone | null>(null);
  /** Governorates still without a zone (the edited zone's own is added back). */
  readonly available = input<readonly string[]>([]);
  readonly presetGovernorate = input<string | null>(null);

  readonly closed = output<void>();
  readonly saved = output<DeliveryZone>();

  protected readonly maxDays = MAX_DAYS;
  protected readonly money = formatMoney;
  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => !!this.zone());
  protected readonly options = computed(() => {
    const own = this.zone()?.governorate;
    return own && !this.available().includes(own) ? [own, ...this.available()] : this.available();
  });

  protected readonly form = this.fb.group(
    {
      governorate: ['', Validators.required],
      fee: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
      estimatedDaysMin: this.fb.control<number | null>(1, [
        Validators.required,
        Validators.min(0),
        Validators.max(MAX_DAYS),
        AppValidators.wholeNumber('أقل مدة'),
      ]),
      estimatedDaysMax: this.fb.control<number | null>(3, [
        Validators.required,
        Validators.min(0),
        Validators.max(MAX_DAYS),
        AppValidators.wholeNumber('أقصى مدة'),
      ]),
      freeShippingThreshold: this.fb.control<number | null>(null, AppValidators.positive('حد الشحن المجاني')),
      isActive: [true],
    },
    { validators: daysRange },
  );

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** One line the customer would read at checkout. */
  protected readonly preview = computed(() => {
    const v = { ...this.form.getRawValue(), ...this.draft() };
    const min = Number(v.estimatedDaysMin);
    const max = Number(v.estimatedDaysMax);
    const fee = Number(v.fee);
    const free = v.freeShippingThreshold ? Number(v.freeShippingThreshold) : null;
    return {
      governorate: v.governorate || 'المحافظة',
      fee: Number.isFinite(fee) && v.fee !== null ? (fee === 0 ? 'توصيل مجاني' : formatMoney(fee)) : '—',
      days: Number.isInteger(min) && Number.isInteger(max) && max >= min ? deliveryDaysLabel(min, max) : '—',
      free: free && free > 0 ? `شحن مجاني للطلبات من ${formatMoney(free)}` : null,
    };
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const z = this.zone();
      const preset = this.presetGovernorate();
      untracked(() =>
        this.form.reset(
          z
            ? {
                governorate: z.governorate,
                fee: z.fee,
                estimatedDaysMin: z.estimatedDaysMin,
                estimatedDaysMax: z.estimatedDaysMax,
                freeShippingThreshold: z.freeShippingThreshold,
                isActive: z.isActive,
              }
            : { governorate: preset ?? '', fee: null, estimatedDaysMin: 1, estimatedDaysMax: 3, freeShippingThreshold: null, isActive: true },
        ),
      );
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const threshold = v.freeShippingThreshold === null || String(v.freeShippingThreshold) === '' ? null : Number(v.freeShippingThreshold);
    const payload: DeliveryZonePayload = {
      governorate: v.governorate,
      fee: Math.round(Number(v.fee) * 100) / 100,
      estimatedDaysMin: Number(v.estimatedDaysMin),
      estimatedDaysMax: Number(v.estimatedDaysMax),
      freeShippingThreshold: threshold,
      isActive: v.isActive,
    };
    const id = this.zone()?.id;
    this.saving.set(true);
    (id ? this.api.update(id, payload) : this.api.create(payload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (zone) => {
          this.toast.success(id ? `تم تحديث منطقة ${zone.governorate}` : `تمت إضافة منطقة ${zone.governorate}`);
          this.saved.emit(zone);
        },
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }
}
