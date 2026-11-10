import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ApiError } from '../../../../core/models/api-response.model';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DrawerComponent } from '../../../../shared/components/drawer/drawer.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { todayIsoDate } from '../../../../shared/utils/date-iso.util';
import { formatDateTime, formatDayMonth, formatMoney } from '../../../../shared/utils/format.util';
import {
  canRefund,
  canRetry,
  canSettle,
  isSettlementOverdue,
  Payment,
  PAYMENT_EVENT_VIEW,
  refundable,
  SETTLEMENT_VIEW,
  STORE_PAYMENT_METHOD_VIEW,
  STORE_PAYMENT_STATUS_VIEW,
} from '../../models/payment.model';
import { PaymentsService } from '../../services/payments.service';

type Busy = 'confirm' | 'fail' | 'retry' | 'refund' | 'settle' | null;
type ModalKind = 'refund' | 'fail' | 'confirm' | null;

/** Payment details: amounts, order, gateway, settlement, refunds, timeline + the actions its status allows. */
@Component({
  selector: 'app-payment-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, DrawerComponent, IconComponent, ModalComponent, StatusPillComponent],
  templateUrl: './payment-drawer.component.html',
  styleUrl: './payment-drawer.component.scss',
})
export class PaymentDrawerComponent {
  private readonly payments = inject(PaymentsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly paymentId = input<string | null>(null);

  readonly closed = output<void>();
  /** Something changed — the list and totals should reload. */
  readonly changed = output<void>();

  protected readonly payment = createQueryResource(this.paymentId, (id) => this.payments.get(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل عملية الدفع',
  });
  /** Ignore a stale payment while switching to another id. */
  protected readonly current = computed(() => {
    const p = this.payment.value();
    return p && p.id === this.paymentId() ? p : null;
  });
  /** Newest event first. */
  protected readonly timeline = computed(() => [...(this.current()?.timeline ?? [])].reverse());

  protected readonly busy = signal<Busy>(null);
  protected readonly modal = signal<ModalKind>(null);

  // Refund form
  protected readonly refundMode = signal<'full' | 'partial'>('full');
  protected readonly refundAmount = signal<number | null>(null);
  protected readonly refundReason = signal('');
  // Fail / confirm forms
  protected readonly failReason = signal('');
  protected readonly confirmReference = signal('');
  protected readonly confirmNote = signal('');

  protected readonly refundError = computed(() => {
    const p = this.current();
    if (!p || this.refundMode() === 'full') return null;
    const amount = this.refundAmount();
    if (amount === null || !(amount > 0)) return 'أدخل مبلغًا أكبر من صفر';
    if (amount > refundable(p)) return `الحد الأقصى للاسترداد ${formatMoney(refundable(p))}`;
    return null;
  });
  protected readonly refundValid = computed(() => !this.refundError() && !!this.refundReason().trim());

  protected readonly statusView = STORE_PAYMENT_STATUS_VIEW;
  protected readonly methodView = STORE_PAYMENT_METHOD_VIEW;
  protected readonly settlementView = SETTLEMENT_VIEW;
  protected readonly eventView = PAYMENT_EVENT_VIEW;
  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;
  protected readonly day = (iso: string) => formatDayMonth(iso.slice(0, 10));
  protected readonly canRefund = canRefund;
  protected readonly canSettle = canSettle;
  protected readonly canRetry = canRetry;
  protected readonly refundable = refundable;
  protected readonly overdue = (p: Payment) => isSettlementOverdue(p, todayIsoDate());

  protected openOrder(p: Payment): void {
    this.router.navigate(['/orders'], { queryParams: { order: p.orderId } });
  }

  // ── Modals ──

  protected openRefund(): void {
    this.refundMode.set('full');
    this.refundAmount.set(null);
    this.refundReason.set('');
    this.modal.set('refund');
  }

  protected openFail(): void {
    this.failReason.set('');
    this.modal.set('fail');
  }

  protected openConfirm(): void {
    this.confirmReference.set('');
    this.confirmNote.set('');
    this.modal.set('confirm');
  }

  protected setRefundAmount(raw: string): void {
    const n = Number.parseFloat(raw);
    this.refundAmount.set(Number.isFinite(n) ? n : null);
  }

  // ── Actions ──

  protected submitRefund(p: Payment): void {
    if (!this.refundValid()) return;
    const amount = this.refundMode() === 'full' ? refundable(p) : this.refundAmount()!;
    this.modal.set(null);
    this.run(
      'refund',
      this.payments.refund(p.id, { amount, reason: this.refundReason().trim() }),
      `تم استرداد ${formatMoney(amount)} من ${p.number} — وتم إشعار العميل`,
    );
  }

  protected submitFail(p: Payment): void {
    const reason = this.failReason().trim();
    if (!reason) return;
    this.modal.set(null);
    this.run('fail', this.payments.fail(p.id, { reason }), `تم تسجيل فشل التحصيل لـ ${p.number}`);
  }

  protected submitConfirm(p: Payment): void {
    this.modal.set(null);
    this.run(
      'confirm',
      this.payments.confirm(p.id, { reference: this.confirmReference().trim() || undefined, note: this.confirmNote().trim() || undefined }),
      `${p.method === 'cod' ? 'تم تأكيد استلام النقدية' : 'تم تأكيد السداد'} — وتم إشعار العميل`,
    );
  }

  protected async retry(p: Payment): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'إعادة محاولة التحصيل',
      message: `ستعود العملية ${p.number} إلى «قيد التحصيل» كمحاولة رقم ${p.attempt + 1} مع شركة الشحن ${p.provider}. هل تريد المتابعة؟`,
      confirmText: 'إعادة المحاولة',
      type: 'info',
    });
    if (ok) this.run('retry', this.payments.retry(p.id), 'تمت جدولة محاولة تحصيل جديدة');
  }

  protected async settle(p: Payment): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'تأكيد التسوية',
      message: `سيتم تسجيل وصول صافي ${formatMoney(p.net)} من ${p.provider} إلى حساب المتجر للعملية ${p.number}. هل تريد المتابعة؟`,
      confirmText: 'تأكيد التسوية',
      type: 'info',
    });
    if (ok) this.run('settle', this.payments.settle(p.id), `تمت تسوية ${p.number}`);
  }

  private run(kind: Busy, request$: Observable<Payment>, success: string): void {
    this.busy.set(kind);
    request$.pipe(finalize(() => this.busy.set(null))).subscribe({
      next: () => {
        this.toast.success(success);
        this.payment.reload();
        this.changed.emit();
      },
      // Reason already toasted by the interceptor. A 409 means the payment's
      // status moved meanwhile (e.g. confirmed by a courier webhook) — reload
      // so only the actions it now allows are offered.
      error: (err: ApiError) => {
        if (err.status !== 409) return;
        this.payment.reload();
        this.changed.emit();
      },
    });
  }
}
