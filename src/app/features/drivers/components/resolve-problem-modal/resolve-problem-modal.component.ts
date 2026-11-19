import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { formatDateTime, formatRelative } from '../../../../shared/utils/format.util';
import { canAssignDriver, canCancelOrder, OrderStatus } from '../../../orders/models/order.model';
import { ORDER_PROBLEM_ERROR_CODES, OrderProblem, OrderProblemBase } from '../../models/order-problem.model';
import { OrderProblemsService } from '../../services/order-problems.service';

/** A problem being answered, with the order it belongs to. */
export interface ResolveTarget {
  problem: OrderProblemBase;
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
}

const QUICK_REPLIES: readonly string[] = [
  'كلمنا العميل، حاول تاني بعد ساعة',
  'العميل أكّد العنوان، حاول التسليم مرة أخرى',
  'رجّع الطلب للمحل',
  'اتواصل مع العميل على الرقم البديل',
];

/**
 * Answers a driver's delivery problem (pushed to the driver app). Moving the
 * order to another driver or cancelling it also closes the problem — those
 * are offered here and run by the parent (`reassign` / `cancelOrder`).
 */
@Component({
  selector: 'app-resolve-problem-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormErrorComponent, IconComponent, ModalComponent],
  templateUrl: './resolve-problem-modal.component.html',
  styleUrl: './resolve-problem-modal.component.scss',
})
export class ResolveProblemModalComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(OrderProblemsService);
  private readonly toast = inject(ToastService);

  readonly target = input<ResolveTarget | null>(null);
  readonly closed = output<void>();
  readonly resolved = output<OrderProblem>();
  /** Someone else answered first — the parent should reload. */
  readonly stale = output<void>();
  readonly reassign = output<ResolveTarget>();
  readonly cancelOrder = output<ResolveTarget>();

  protected readonly quickReplies = QUICK_REPLIES;
  protected readonly relative = formatRelative;
  protected readonly dateTime = formatDateTime;
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    resolution: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
  });

  protected readonly canReassign = computed(() => {
    const t = this.target();
    return !!t && canAssignDriver(t.orderStatus);
  });
  protected readonly canCancel = computed(() => {
    const t = this.target();
    return !!t && canCancelOrder(t.orderStatus);
  });
  protected readonly isShipped = computed(() => this.target()?.orderStatus === 'shipped');

  constructor() {
    effect(() => {
      if (this.target()) untracked(() => this.form.reset());
    });
  }

  protected useReply(text: string): void {
    this.form.controls.resolution.setValue(text);
    this.form.controls.resolution.markAsDirty();
  }

  protected close(): void {
    if (!this.saving()) this.closed.emit();
  }

  protected submit(): void {
    const t = this.target();
    if (!t) return;
    const resolution = this.form.controls.resolution.value.trim();
    if (!resolution) this.form.controls.resolution.setValue('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api
      .resolve(t.problem.id, resolution)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (p) => {
          this.toast.success(`تم الرد على بلاغ ${t.problem.driverName} — وصله الرد على التطبيق`);
          this.resolved.emit(p);
        },
        error: (err: ApiError) => {
          if (hasErrorCode(err, ORDER_PROBLEM_ERROR_CODES.alreadyResolved)) {
            this.toast.info('تم الرد على هذا البلاغ من مستخدم آخر — تم تحديث البيانات');
            this.stale.emit();
            return;
          }
          const rest = applyServerErrors(this.form, err);
          if (rest || !err.fieldErrors) this.toast.error(rest ?? err.message);
        },
      });
  }
}
