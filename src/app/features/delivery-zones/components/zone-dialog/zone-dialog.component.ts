import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
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

/** Optional fee (express / scheduled): required and ≥ 0 while offered; disabled (and sent as `null`) otherwise. */
const optionalFeeValidators = (subject: string) => [Validators.required, AppValidators.nonNegative(subject)];

const toFee = (value: unknown): number => Math.round(Number(value) * 100) / 100;

const isBlank = (value: unknown): boolean => value === null || value === undefined || String(value) === '';

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
  private readonly destroyRef = inject(DestroyRef);

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
      expressEnabled: [false],
      expressFee: this.fb.control<number | null>(null, optionalFeeValidators('رسوم التوصيل السريع')),
      scheduledEnabled: [false],
      scheduledFee: this.fb.control<number | null>(null, optionalFeeValidators('رسوم التوصيل في موعد')),
      isActive: [true],
    },
    { validators: daysRange },
  );

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** One line the customer would read at checkout, per delivery type offered. */
  protected readonly preview = computed(() => {
    this.draft();
    const v = this.form.getRawValue();
    const min = Number(v.estimatedDaysMin);
    const max = Number(v.estimatedDaysMax);
    const free = v.freeShippingThreshold ? Number(v.freeShippingThreshold) : null;
    return {
      governorate: v.governorate || 'المحافظة',
      fee: this.feeText(v.fee) ?? '—',
      days: Number.isInteger(min) && Number.isInteger(max) && max >= min ? deliveryDaysLabel(min, max) : '—',
      free: free && free > 0 ? `شحن مجاني للطلبات من ${formatMoney(free)} (التوصيل العادي فقط)` : null,
      express: v.expressEnabled ? (this.feeText(v.expressFee) ?? '—') : null,
      scheduled: v.scheduledEnabled ? (this.feeText(v.scheduledFee) ?? '—') : null,
    };
  });

  constructor() {
    this.bindOptionalFee(this.form.controls.expressEnabled, this.form.controls.expressFee);
    this.bindOptionalFee(this.form.controls.scheduledEnabled, this.form.controls.scheduledFee);

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
                expressEnabled: z.expressFee !== null && z.expressFee !== undefined,
                expressFee: z.expressFee ?? null,
                scheduledEnabled: z.scheduledFee !== null && z.scheduledFee !== undefined,
                scheduledFee: z.scheduledFee ?? null,
                isActive: z.isActive,
              }
            : {
                governorate: preset ?? '',
                fee: null,
                estimatedDaysMin: 1,
                estimatedDaysMax: 3,
                freeShippingThreshold: null,
                expressEnabled: false,
                expressFee: null,
                scheduledEnabled: false,
                scheduledFee: null,
                isActive: true,
              },
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
    const payload: DeliveryZonePayload = {
      governorate: v.governorate,
      fee: toFee(v.fee),
      estimatedDaysMin: Number(v.estimatedDaysMin),
      estimatedDaysMax: Number(v.estimatedDaysMax),
      freeShippingThreshold: isBlank(v.freeShippingThreshold) ? null : Number(v.freeShippingThreshold),
      // Always sent — an omitted fee is cleared by the server. Unticked = not offered = null.
      expressFee: v.expressEnabled ? toFee(v.expressFee) : null,
      scheduledFee: v.scheduledEnabled ? toFee(v.scheduledFee) : null,
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

  /** "مجاني" / "120 ج.م", or null when the value isn't a usable number yet. */
  private feeText(value: unknown): string | null {
    if (isBlank(value)) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    return n === 0 ? 'مجاني' : formatMoney(n);
  }

  /** The "متاح" checkbox switches its fee input on / off (a disabled control skips validation). */
  private bindOptionalFee(enabled: FormControl<boolean>, fee: FormControl<number | null>): void {
    const sync = (on: boolean) => {
      if (on === fee.enabled) return;
      if (on) fee.enable({ emitEvent: false });
      else fee.disable({ emitEvent: false });
    };
    sync(enabled.value);
    enabled.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(sync);
  }
}
