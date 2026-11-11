import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DrawerComponent } from '../../../../shared/components/drawer/drawer.component';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { formatDateTime, formatMoney } from '../../../../shared/utils/format.util';
import { AppValidators } from '../../../../shared/validators/app-validators';
import { runDrawerIntent } from '../../../../shared/utils/drawer-intent.util';
import {
  canAnswer,
  PART_REQUEST_ERROR_CODES,
  PartRequestAction,
  partRequestActions,
  PART_REQUEST_STATUS_VIEW,
  PartRequest,
  QUOTE_RULES,
  QuotePayload,
  REJECT_REASON_MAX,
} from '../../models/part-request.model';
import { PartRequestsService } from '../../services/part-requests.service';
import { PartRequestImagesComponent } from '../part-request-images/part-request-images.component';

type Busy = 'quote' | 'reject' | null;

/** One part request: customer, part, photos, quote/rejection — with the quote and reject actions. */
@Component({
  selector: 'app-part-request-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    DrawerComponent,
    FormErrorComponent,
    IconComponent,
    ModalComponent,
    PartRequestImagesComponent,
    ReactiveFormsModule,
    StatusPillComponent,
  ],
  templateUrl: './part-request-drawer.component.html',
  styleUrl: './part-request-drawer.component.scss',
})
export class PartRequestDrawerComponent {
  private readonly service = inject(PartRequestsService);
  private readonly toast = inject(ToastService);

  /** Open when set — bound to the `request` URL param by the page. */
  readonly requestId = input<string | null>(null);
  readonly closed = output<void>();
  /** After a quote / rejection (or a stale-status conflict) so the page refreshes its list. */
  readonly changed = output<void>();
  /** Action requested from the table row — run once the request has loaded. */
  readonly intent = input<PartRequestAction | null>(null);
  readonly intentDone = output<void>();

  protected readonly request = createQueryResource(this.requestId, (id) => this.service.get(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل الطلب',
  });

  /** The loaded request only while it is the one asked for (no flash of the previous one). */
  protected readonly current = computed(() => {
    const r = this.request.value();
    return r && r.id === this.requestId() ? r : null;
  });
  protected readonly answerable = computed(() => {
    const r = this.current();
    return !!r && canAnswer(r);
  });
  /** Danger last, primary first in reading order (RTL footer). */
  protected readonly actions = computed(() => {
    const r = this.current();
    return r ? [...partRequestActions(r)].reverse() : [];
  });

  protected readonly busy = signal<Busy>(null);
  protected readonly dialog = signal<'quote' | 'reject' | null>(null);

  protected readonly rules = QUOTE_RULES;
  protected readonly rejectMax = REJECT_REASON_MAX;

  protected readonly quoteForm = new FormGroup({
    price: new FormControl<number | null>(null, [Validators.required, AppValidators.positive('السعر')]),
    validDays: new FormControl<number | null>(QUOTE_RULES.defaultDays, [
      Validators.required,
      AppValidators.wholeNumber('مدة صلاحية العرض'),
      Validators.min(QUOTE_RULES.minDays),
      Validators.max(QUOTE_RULES.maxDays),
    ]),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(QUOTE_RULES.maxNotes)] }),
  });

  protected readonly rejectForm = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(REJECT_REASON_MAX)],
    }),
  });

  protected readonly statusView = PART_REQUEST_STATUS_VIEW;
  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;

  constructor() {
    runDrawerIntent(this.current, this.intent, (r, action) => this.runAction(r, action), () => this.intentDone.emit());
  }

  /** Single entry for an action, from the drawer footer or a table row. */
  protected runAction(r: PartRequest, action: PartRequestAction): void {
    if (!partRequestActions(r).some((a) => a.key === action)) {
      this.toast.info(`لم يعد الطلب ${r.number} بانتظار المراجعة — حالته الآن «${PART_REQUEST_STATUS_VIEW[r.status].label}»`);
      return;
    }
    if (action === 'quote') this.openQuote();
    else this.openReject();
  }

  protected openQuote(): void {
    this.quoteForm.reset({ price: null, validDays: QUOTE_RULES.defaultDays, notes: '' });
    this.dialog.set('quote');
  }

  protected openReject(): void {
    this.rejectForm.reset({ reason: '' });
    this.dialog.set('reject');
  }

  protected closeDialog(): void {
    if (!this.busy()) this.dialog.set(null);
  }

  protected submitQuote(request: PartRequest): void {
    if (this.quoteForm.invalid) {
      this.quoteForm.markAllAsTouched();
      return;
    }
    const { price, validDays, notes } = this.quoteForm.getRawValue();
    const payload: QuotePayload = {
      price: Number(price),
      validDays: Number(validDays),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    this.busy.set('quote');
    this.service
      .quote(request.id, payload)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: () => this.done(`تم إرسال عرض السعر ${formatMoney(payload.price)} وإشعار العميل`),
        error: (err: ApiError) => this.fail(err, this.quoteForm, PART_REQUEST_ERROR_CODES.cannotQuote),
      });
  }

  protected submitReject(request: PartRequest): void {
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }
    this.busy.set('reject');
    this.service
      .reject(request.id, { reason: this.rejectForm.getRawValue().reason.trim() })
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: () => this.done('تم رفض الطلب وإشعار العميل'),
        error: (err: ApiError) => this.fail(err, this.rejectForm, PART_REQUEST_ERROR_CODES.cannotReject),
      });
  }

  private done(message: string): void {
    this.dialog.set(null);
    this.toast.success(message);
    this.request.reload();
    this.changed.emit();
  }

  /** The error interceptor already toasted the server's message; this only fixes up the UI. */
  private fail(err: ApiError, form: FormGroup, staleCode: string): void {
    // Someone else answered it (or the customer cancelled): show its real status.
    if (hasErrorCode(err, staleCode) || err.status === 409) {
      this.dialog.set(null);
      this.request.reload();
      this.changed.emit();
      return;
    }
    applyServerErrors(form, err);
  }
}
