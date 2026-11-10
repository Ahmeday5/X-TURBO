import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DrawerComponent } from '../../../../shared/components/drawer/drawer.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { formatDateTime, formatDayMonth, formatMoney } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { Voucher, VOUCHER_KIND_CONFIG, VOUCHER_METHOD_LABEL, VOUCHER_STATUS_VIEW } from '../../models/voucher.model';
import { VouchersService } from '../../services/vouchers.service';
import { ApiError } from '../../../../core/models/api-response.model';
import { cashSideLabel, counterpartyName, JOURNAL_LINES_PLURAL, VOUCHER_KIND_ICON } from '../../utils/voucher-view';

type Busy = 'post' | 'cancel' | 'delete' | null;

/** Read-only view of a voucher with the actions its status allows. */
@Component({
  selector: 'app-voucher-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, IconComponent, ModalComponent, StatusPillComponent],
  templateUrl: './voucher-drawer.component.html',
  styleUrl: './voucher-drawer.component.scss',
})
export class VoucherDrawerComponent {
  private readonly vouchers = inject(VouchersService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly voucherId = input<string | null>(null);

  readonly closed = output<void>();
  /** Status changed / deleted — the list should reload. */
  readonly changed = output<void>();
  readonly edit = output<string>();
  readonly print = output<Voucher>();

  protected readonly voucher = createQueryResource(this.voucherId, (id) => this.vouchers.get(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل السند',
  });
  /** Ignore a stale voucher while switching to another id. */
  protected readonly current = computed(() => {
    const v = this.voucher.value();
    return v && v.id === this.voucherId() ? v : null;
  });
  protected readonly cfg = computed(() => {
    const v = this.current();
    return v ? VOUCHER_KIND_CONFIG[v.kind] : null;
  });
  protected readonly icon = computed(() => VOUCHER_KIND_ICON[this.current()?.kind ?? 'journal']);

  protected readonly busy = signal<Busy>(null);
  protected readonly cancelOpen = signal(false);
  protected readonly cancelReason = signal('');

  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;
  protected readonly dayMonth = (iso: string) => formatDayMonth(iso.slice(0, 10));
  protected readonly statusView = VOUCHER_STATUS_VIEW;
  protected readonly methodLabel = VOUCHER_METHOD_LABEL;
  protected readonly counterparty = counterpartyName;
  protected readonly cashSide = cashSideLabel;
  protected readonly linesLabel = (n: number) => pluralAr(n, JOURNAL_LINES_PLURAL);

  /** The double entry a receipt / payment produces (journal shows its own lines). */
  protected readonly entry = computed(() => {
    const v = this.current();
    if (!v || v.kind === 'journal') return null;
    const cash = v.cashAccountName ?? 'الخزينة';
    const other = counterpartyName(v);
    return v.kind === 'receipt' ? { debit: cash, credit: other } : { debit: other, credit: cash };
  });

  protected async post(v: Voucher): Promise<void> {
    const ok = await this.dialog.confirm({
      title: `ترحيل ${v.number}`,
      message: 'بعد الترحيل يُسجَّل القيد في دفتر الأستاذ وتتأثر الأرصدة، ولا يمكن تعديل السند. هل تريد المتابعة؟',
      confirmText: 'ترحيل',
      type: 'info',
    });
    if (!ok) return;
    this.busy.set('post');
    this.vouchers
      .post(v.id)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: () => {
          this.toast.success(`تم ترحيل ${v.number}`);
          this.voucher.reload();
          this.changed.emit();
        },
        error: (err: ApiError) => this.onActionError(err),
      });
  }

  protected openCancel(): void {
    this.cancelReason.set('');
    this.cancelOpen.set(true);
  }

  protected confirmCancel(v: Voucher): void {
    const reason = this.cancelReason().trim();
    if (!reason) return;
    this.cancelOpen.set(false);
    this.busy.set('cancel');
    this.vouchers
      .cancel(v.id, reason)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: () => {
          this.toast.success(`تم إلغاء ${v.number}`);
          this.voucher.reload();
          this.changed.emit();
        },
        error: (err: ApiError) => this.onActionError(err),
      });
  }

  protected async remove(v: Voucher): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'حذف المسودة',
      message: `سيتم حذف المسودة ${v.number} نهائيًا. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    this.busy.set('delete');
    this.vouchers
      .delete(v.id)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: () => {
          this.toast.success('تم حذف المسودة');
          this.changed.emit();
          this.closed.emit();
        },
        error: (err: ApiError) => this.onActionError(err),
      });
  }

  /**
   * The server's reason is already toasted by the error interceptor. On a 409
   * the voucher's status changed elsewhere (posted / cancelled by someone
   * else) — reload so the drawer shows the actions that are actually allowed.
   */
  private onActionError(err: ApiError): void {
    if (err.status !== 409) return;
    this.voucher.reload();
    this.changed.emit();
  }
}
