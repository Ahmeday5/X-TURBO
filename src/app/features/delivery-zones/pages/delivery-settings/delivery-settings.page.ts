import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors, apiErrorToMessage } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { addDaysIso, todayIsoDate } from '../../../../shared/utils/date-iso.util';
import { formatDateTime, formatInteger, formatLongDate } from '../../../../shared/utils/format.util';
import { AppValidators } from '../../../../shared/validators/app-validators';
import {
  daySlotLabels,
  dayName,
  DELIVERY_SETTINGS_MESSAGES,
  DELIVERY_SETTINGS_RULES as RULES,
  DeliverySettings,
  DeliverySettingsPayload,
  groupSlotsByDay,
  HOUR_OPTIONS,
  leadTimeLabel,
  WEEK_DAYS,
} from '../../models/delivery-settings.model';
import { hourLabel, slotTimeLabel } from '../../models/delivery-type.model';
import { DeliverySettingsService } from '../../services/delivery-settings.service';

/**
 * Sets (or clears) one rule error on a control without touching its other
 * errors — cross-field rules land on the field the user must change.
 */
function setRuleError(control: AbstractControl | null, key: string, message: string | null): void {
  if (!control) return;
  const { [key]: current, ...rest } = control.errors ?? {};
  if (message) {
    if (current !== message) control.setErrors({ ...rest, [key]: message });
  } else if (current !== undefined) {
    control.setErrors(Object.keys(rest).length ? rest : null);
  }
}

/** Cross-field rules: end hour after start, an ETA text while express is on, at least one open day. */
function settingsRules(group: AbstractControl): ValidationErrors | null {
  const start = Number(group.get('slotStartHour')?.value);
  const end = Number(group.get('slotEndHour')?.value);
  setRuleError(
    group.get('slotEndHour'),
    'range',
    end <= start ? `${DELIVERY_SETTINGS_MESSAGES.endBeforeStart} — اختر ساعة بعد ${hourLabel(start)}، مثال: ${hourLabel(Math.min(start + 1, 24))}` : null,
  );

  const expressOn = !!group.get('expressEnabled')?.value;
  const eta = String(group.get('expressEtaText')?.value ?? '').trim();
  setRuleError(
    group.get('expressEtaText'),
    'etaRequired',
    expressOn && !eta ? 'اكتب مدة التوصيل السريع التي سيراها العميل — مثال: خلال 24 ساعة' : null,
  );

  const closed = (group.get('closedDays')?.value as number[] | undefined) ?? [];
  setRuleError(
    group.get('closedDays'),
    'allClosed',
    closed.length >= WEEK_DAYS.length ? `${DELIVERY_SETTINGS_MESSAGES.allDaysClosed} — اترك يومًا واحدًا على الأقل مفتوحًا` : null,
  );
  return null;
}

const intField = (subject: string, min: number, max: number) => [
  Validators.required,
  Validators.min(min),
  Validators.max(max),
  AppValidators.wholeNumber(subject),
];

/**
 * Delivery settings of the mobile app: express on/off + the ETA text the
 * customer reads, and how the one-hour slots of "حدد موعد" are built (hours,
 * days ahead, capacity, lead time, closed days). Below the form, the slots
 * exactly as the customer sees them now. Gated by `Settings.Manage`.
 */
@Component({
  selector: 'app-delivery-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, IconComponent, FormErrorComponent],
  templateUrl: './delivery-settings.page.html',
  styleUrl: './delivery-settings.page.scss',
})
export class DeliverySettingsPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(DeliverySettingsService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  protected readonly rules = RULES;
  protected readonly weekDays = WEEK_DAYS;
  protected readonly startHours = HOUR_OPTIONS.slice(0, -1);
  protected readonly endHours = HOUR_OPTIONS.slice(1);
  protected readonly dateTime = formatDateTime;
  protected readonly slotTime = slotTimeLabel;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly current = signal<DeliverySettings | null>(null);

  protected readonly form = this.fb.group(
    {
      expressEnabled: [false],
      expressEtaText: ['', Validators.maxLength(RULES.etaMax)],
      scheduledEnabled: [false],
      slotStartHour: this.fb.control(10, Validators.required),
      slotEndHour: this.fb.control(22, Validators.required),
      daysAhead: this.fb.control<number | null>(3, intField('عدد الأيام', RULES.daysAheadMin, RULES.daysAheadMax)),
      slotCapacity: this.fb.control<number | null>(0, intField('أقصى عدد طلبات', RULES.capacityMin, RULES.capacityMax)),
      leadMinutes: this.fb.control<number | null>(60, intField('أقل وقت قبل الموعد', RULES.leadMin, RULES.leadMax)),
      closedDays: this.fb.control<number[]>([]),
    },
    { validators: settingsRules },
  );

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  // ── Live slots (saved settings + current bookings) ──
  private readonly slotsTick = signal(0);
  protected readonly slots = createQueryResource(this.slotsTick, () => this.api.slots(), {
    errorMessage: 'تعذّر تحميل المواعيد المتاحة',
  });
  protected readonly slotDays = computed(() => {
    const today = todayIsoDate();
    const tomorrow = addDaysIso(today, 1);
    return groupSlotsByDay(this.slots.value() ?? []).map((d) => ({
      ...d,
      title: formatLongDate(d.date),
      tag: d.date === today ? 'اليوم' : d.date === tomorrow ? 'غدًا' : null,
    }));
  });
  protected readonly bookedCount = computed(() => (this.slots.value() ?? []).filter((s) => !s.available).length);

  /** What the customer will get with the values on screen (not saved yet). */
  protected readonly summary = computed(() => {
    this.draft();
    const v = this.form.getRawValue();
    const start = Number(v.slotStartHour);
    const end = Number(v.slotEndHour);
    const days = Number(v.daysAhead);
    const capacity = Number(v.slotCapacity);
    const perDay = daySlotLabels(start, end);
    return {
      expressOn: v.expressEnabled,
      eta: v.expressEtaText.trim() || '—',
      scheduledOn: v.scheduledEnabled,
      perDay,
      hours: perDay.length ? `${hourLabel(start)} إلى ${hourLabel(end)}` : '—',
      days: Number.isInteger(days) && days >= 1 ? (days === 1 ? 'اليوم فقط' : `اليوم + ${formatInteger(days - 1)} يوم بعده`) : '—',
      capacity: !Number.isFinite(capacity) ? '—' : capacity === 0 ? 'مفتوح بدون حد' : `${formatInteger(capacity)} طلب في الساعة`,
      lead: leadTimeLabel(Number(v.leadMinutes)),
      closed: v.closedDays.length ? [...v.closedDays].sort(byWeekOrder).map(dayName).join('، ') : 'لا يوجد',
    };
  });

  constructor() {
    this.load();
  }

  protected hourOption(h: number): string {
    if (h === 0 || h === 24) return `${hourLabel(h)} (منتصف الليل)`;
    if (h === 12) return `${hourLabel(h)} (الظهر)`;
    return hourLabel(h);
  }

  protected isClosed(day: number): boolean {
    return this.form.controls.closedDays.value.includes(day);
  }

  protected toggleDay(day: number): void {
    const ctrl = this.form.controls.closedDays;
    const next = ctrl.value.includes(day) ? ctrl.value.filter((d) => d !== day) : [...ctrl.value, day];
    ctrl.setValue(next.sort(byWeekOrder));
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .get()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (s) => this.apply(s),
        error: (err: ApiError) => this.loadError.set(apiErrorToMessage(err, 'تعذّر تحميل إعدادات التوصيل')),
      });
  }

  protected reloadSlots(): void {
    this.slotsTick.update((n) => n + 1);
  }

  protected reset(): void {
    const s = this.current();
    if (s) this.apply(s);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('راجع الحقول المظللة قبل الحفظ');
      return;
    }
    const v = this.form.getRawValue();
    const payload: DeliverySettingsPayload = {
      expressEnabled: v.expressEnabled,
      expressEtaText: v.expressEtaText.trim(),
      scheduledEnabled: v.scheduledEnabled,
      slotStartHour: Number(v.slotStartHour),
      slotEndHour: Number(v.slotEndHour),
      daysAhead: Number(v.daysAhead),
      slotCapacity: Number(v.slotCapacity),
      leadMinutes: Number(v.leadMinutes),
      closedDays: [...new Set(v.closedDays)].sort((a, b) => a - b),
    };
    this.saving.set(true);
    this.api
      .save(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (s) => {
          this.apply(s);
          this.toast.success('تم حفظ إعدادات التوصيل');
          this.reloadSlots();
        },
        // 422 → each message under its field; anything that matches no field → a toast.
        error: (err: ApiError) => {
          const rest = applyServerErrors(this.form, err);
          if (rest) this.toast.error(rest);
        },
      });
  }

  private apply(s: DeliverySettings): void {
    this.current.set(s);
    this.form.reset({
      expressEnabled: s.expressEnabled,
      expressEtaText: s.expressEtaText ?? '',
      scheduledEnabled: s.scheduledEnabled,
      slotStartHour: s.slotStartHour,
      slotEndHour: s.slotEndHour,
      daysAhead: s.daysAhead,
      slotCapacity: s.slotCapacity,
      leadMinutes: s.leadMinutes,
      closedDays: [...(s.closedDays ?? [])].sort(byWeekOrder),
    });
  }
}

/** Sorts day values in the on-screen week order (Saturday first). */
function byWeekOrder(a: number, b: number): number {
  const rank = (d: number) => WEEK_DAYS.findIndex((w) => w.value === d);
  return rank(a) - rank(b);
}
