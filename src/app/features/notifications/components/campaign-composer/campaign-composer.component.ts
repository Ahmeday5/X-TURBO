import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { catchError, finalize, firstValueFrom, map, of } from 'rxjs';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { formatInteger } from '../../../../shared/utils/format.util';
import {
  Campaign,
  CAMPAIGN_ERROR_CODES,
  CAMPAIGN_REF_LABEL,
  CAMPAIGN_REF_TYPES,
  CAMPAIGN_RULES,
  CampaignCustomer,
  CampaignRefType,
  CampaignTarget,
  SendCampaignPayload,
} from '../../models/notification-campaign.model';
import { CampaignRefOptionsService } from '../../services/campaign-ref-options.service';
import { NotificationCampaignsService } from '../../services/notification-campaigns.service';
import { PhonePreviewComponent } from '../phone-preview/phone-preview.component';
import { RecipientPickerComponent } from '../recipient-picker/recipient-picker.component';

type SendStep = 'counting' | 'sending' | null;

const REF_PLACEHOLDER: Record<CampaignRefType, string> = {
  product: 'اختر المنتج',
  category: 'اختر التصنيف',
  order: 'اختر الطلب',
};

/**
 * Compose and send a push campaign: title/body with counters, audience (all or
 * picked customers), an optional in-app link, a live phone preview, and a
 * confirmation with the audience size before sending to everyone.
 */
@Component({
  selector: 'app-campaign-composer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormErrorComponent,
    IconComponent,
    PhonePreviewComponent,
    ReactiveFormsModule,
    RecipientPickerComponent,
    SearchableSelectComponent,
  ],
  templateUrl: './campaign-composer.component.html',
  styleUrl: './campaign-composer.component.scss',
})
export class CampaignComposerComponent {
  private readonly service = inject(NotificationCampaignsService);
  private readonly refOptions = inject(CampaignRefOptionsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  /** Emitted with the created campaign (usually still delivering). */
  readonly sent = output<Campaign>();

  protected readonly rules = CAMPAIGN_RULES;
  protected readonly refTypes = CAMPAIGN_REF_TYPES;
  protected readonly refLabel = CAMPAIGN_REF_LABEL;
  protected readonly refPlaceholder = REF_PLACEHOLDER;

  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(CAMPAIGN_RULES.titleMax)],
    }),
    body: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(CAMPAIGN_RULES.bodyMax)],
    }),
    target: new FormControl<CampaignTarget>('all', { nonNullable: true }),
    refType: new FormControl<CampaignRefType | ''>('', { nonNullable: true }),
    refId: new FormControl('', { nonNullable: true, validators: [(c) => this.refIdRule(c)] }),
    /** Mirrors the picker so 422 `errors.customerIds` lands on a control. */
    customerIds: new FormControl<string[]>([], { nonNullable: true, validators: [(c) => this.recipientsRule(c)] }),
  });

  protected readonly recipients = signal<readonly CampaignCustomer[]>([]);
  protected readonly step = signal<SendStep>(null);

  private readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
  protected readonly target = computed(() => this.value().target);
  protected readonly refType = computed<CampaignRefType | null>(() => this.value().refType || null);

  protected readonly options = createQueryResource(this.refType, (type) => this.refOptions.load(type!), {
    enabled: (type) => !!type,
    errorMessage: 'تعذّر تحميل الخيارات',
  });

  /** "منتج: تيل فرامل" for the preview, once a target is picked. */
  protected readonly linkLabel = computed(() => {
    const { refType, refId } = this.value();
    if (!refType || !refId) return null;
    const option = this.options.value()?.find((o) => o.value === refId);
    return `${CAMPAIGN_REF_LABEL[refType]}: ${option?.label ?? '—'}`;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    const { target, refType, refId, customerIds } = this.form.controls;

    // Dependent rules re-check when what they depend on changes.
    target.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => customerIds.updateValueAndValidity());
    refType.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      refId.setValue('');
      refId.markAsUntouched();
    });

    // The picker is the source of truth; the control only carries validation.
    effect(() => customerIds.setValue(this.recipients().map((c) => c.id)));
  }

  protected async submit(): Promise<void> {
    if (this.step()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.toPayload();
    if (payload.target === 'all' && !(await this.confirmBroadcast())) return;

    this.step.set('sending');
    this.service
      .send(payload)
      .pipe(finalize(() => this.step.set(null)))
      .subscribe({
        next: (campaign) => {
          this.toast.success(`تم إرسال «${campaign.title}» إلى ${formatInteger(campaign.recipientCount)} عميل`);
          this.reset();
          this.sent.emit(campaign);
        },
        // The interceptor toasts the message; 422 also marks the fields.
        error: (err: ApiError) => {
          if (!hasErrorCode(err, CAMPAIGN_ERROR_CODES.noRecipients)) applyServerErrors(this.form, err);
        },
      });
  }

  protected reset(): void {
    this.form.reset();
    this.recipients.set([]);
    this.form.markAsUntouched();
  }

  /** "Send to everyone" is irreversible — confirm with the real audience size. */
  private async confirmBroadcast(): Promise<boolean> {
    this.step.set('counting');
    const count = await firstValueFrom(
      this.service
        .customers({ pageIndex: 1, pageSize: 1, search: '', sort: null, filters: {} })
        .pipe(
          map((page) => page.count),
          catchError(() => of(null)),
        ),
    );
    this.step.set(null);
    const audience = count === null ? 'كل عملاء التطبيق' : `${formatInteger(count)} عميل`;
    return this.dialog.confirm({
      title: 'إرسال لكل العملاء',
      message: `سيتم الإرسال إلى ${audience}. لا يمكن التراجع عن الإشعار بعد إرساله. هل تريد المتابعة؟`,
      confirmText: 'إرسال الآن',
      type: 'warning',
    });
  }

  private toPayload(): SendCampaignPayload {
    const { title, body, target, refType, refId } = this.form.getRawValue();
    return {
      title: title.trim(),
      body: body.trim(),
      target,
      ...(target === 'customers' ? { customerIds: this.recipients().map((c) => c.id) } : {}),
      ...(refType && refId ? { refType, refId } : {}),
    };
  }

  // ── conditional rules (read sibling controls; `form` is undefined while it's being built) ──

  private recipientsRule(control: AbstractControl<string[]>): ValidationErrors | null {
    if (this.form?.controls.target.value !== 'customers') return null;
    const count = control.value?.length ?? 0;
    if (!count) return { recipients: 'اختر عميلًا واحدًا على الأقل من الجدول — أو أرسل لـ«كل العملاء»' };
    if (count > CAMPAIGN_RULES.maxRecipients) {
      return { recipients: `الحد الأقصى ${formatInteger(CAMPAIGN_RULES.maxRecipients)} عميل في الإرسال الواحد (المختار ${formatInteger(count)})` };
    }
    return null;
  }

  private refIdRule(control: AbstractControl<string>): ValidationErrors | null {
    const type = this.form?.controls.refType.value;
    if (!type || control.value) return null;
    return { ref: `اختر ${CAMPAIGN_REF_LABEL[type]} الذي يفتحه الإشعار — أو اختر «بدون رابط»` };
  }
}
