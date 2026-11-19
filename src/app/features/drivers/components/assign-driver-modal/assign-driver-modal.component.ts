import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { finalize } from 'rxjs';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { matchesAll, tokenize } from '../../../../shared/utils/arabic-search.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { toLocalMobile } from '../../../../shared/utils/phone.util';
import { Order, ORDER_ERROR_CODES } from '../../../orders/models/order.model';
import { OrdersService } from '../../../orders/services/orders.service';
import { DRIVER_ERROR_CODES, DriverLookup } from '../../models/driver.model';
import { DriversService } from '../../services/drivers.service';

/** The order a driver is being picked for. */
export interface AssignTarget {
  id: string;
  number: string;
  /** Current driver — shown as such and not selectable. */
  driverId: string | null;
}

const LOAD_PLURAL = { zero: 'بدون طلبات حاليًا', one: 'معه طلب واحد', two: 'معه طلبان', few: 'معه # طلبات', other: 'معه # طلب' };

/**
 * Picks the driver for an order (`PATCH orders/:id/driver`). Lists active
 * drivers least-busy first, with a quick search. `target = null` → closed.
 */
@Component({
  selector: 'app-assign-driver-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, ModalComponent],
  templateUrl: './assign-driver-modal.component.html',
  styleUrl: './assign-driver-modal.component.scss',
})
export class AssignDriverModalComponent {
  private readonly drivers = inject(DriversService);
  private readonly orders = inject(OrdersService);
  private readonly toast = inject(ToastService);

  readonly target = input<AssignTarget | null>(null);
  readonly closed = output<void>();
  readonly assigned = output<Order>();
  /** The order changed under us (confirmed / closed elsewhere) — the parent should reload it. */
  readonly stale = output<void>();

  private readonly openKey = computed(() => this.target()?.id ?? null);
  protected readonly lookup = createQueryResource(this.openKey, () => this.drivers.lookup(), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل المناديب',
  });

  protected readonly query = signal('');
  protected readonly selected = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly options = computed(() => {
    const tokens = tokenize(this.query());
    const all = this.lookup.value() ?? [];
    return tokens.length ? all.filter((d) => matchesAll([d.name, d.phone, toLocalMobile(d.phone)], tokens)) : all;
  });

  protected readonly phone = toLocalMobile;
  protected readonly load = (n: number) => pluralAr(n, LOAD_PLURAL);

  constructor() {
    effect(() => {
      this.target();
      untracked(() => {
        this.query.set('');
        this.selected.set(null);
      });
    });
  }

  protected isCurrent(d: DriverLookup): boolean {
    return d.id === this.target()?.driverId;
  }

  protected pick(d: DriverLookup): void {
    if (!this.isCurrent(d) && !this.saving()) this.selected.set(d.id);
  }

  protected close(): void {
    if (!this.saving()) this.closed.emit();
  }

  protected submit(): void {
    const t = this.target();
    const driver = this.lookup.value()?.find((d) => d.id === this.selected());
    if (!t || !driver) return;

    this.saving.set(true);
    this.orders
      .assignDriver(t.id, driver.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (order) => {
          const previous = t.driverId ? ' — وتم إبلاغ المندوب السابق بسحب الطلب منه' : '';
          this.toast.success(`تم تعيين ${driver.name} على الطلب ${t.number} ووصله إشعار بالطلب${previous}`);
          this.assigned.emit(order);
        },
        error: (err: ApiError) => this.onError(err),
      });
  }

  private onError(err: ApiError): void {
    if (hasErrorCode(err, ORDER_ERROR_CODES.notConfirmed)) {
      this.toast.warning('أكّد الطلب أولًا، ثم عيّن المندوب');
      this.stale.emit();
      return;
    }
    if (hasErrorCode(err, ORDER_ERROR_CODES.closed)) {
      this.toast.warning(err.message || 'الطلب اتسلّم أو اتلغى — لم يعد ممكنًا تغيير المندوب');
      this.stale.emit();
      return;
    }
    if (hasErrorCode(err, DRIVER_ERROR_CODES.inactive) || err.status === 404) {
      this.toast.warning(err.message || 'هذا المندوب لم يعد متاحًا — تم تحديث القائمة');
      this.selected.set(null);
      this.lookup.reload();
      return;
    }
    this.toast.error(err.message);
  }
}
