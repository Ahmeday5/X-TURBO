import { inject, Injectable } from '@angular/core';
import { from, map, mergeMap, toArray } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { formatInteger } from '../../../shared/utils/format.util';
import { openPrintWindow, POPUP_BLOCKED_MESSAGE, writePrintWindow } from '../../../shared/utils/print-window.util';
import { Order } from '../models/order.model';
import { ordersPrintHtml } from '../utils/print-order';
import { OrdersService } from './orders.service';

/** Orders per print job — each needs its own details request. */
export const MAX_ORDERS_PER_PRINT = 50;
const PARALLEL_REQUESTS = 4;

@Injectable({ providedIn: 'root' })
export class OrderPrintService {
  private readonly orders = inject(OrdersService);
  private readonly toast = inject(ToastService);

  /** An order already loaded with its lines (the details drawer). */
  print(order: Order): void {
    const win = openPrintWindow(`طلب ${order.number}`);
    if (!win) {
      this.toast.error(POPUP_BLOCKED_MESSAGE);
      return;
    }
    writePrintWindow(win, ordersPrintHtml([order]));
  }

  /** Loads each order's details (lines, driver), then prints them in the given order, one page each. */
  printByIds(ids: readonly string[]): void {
    if (!ids.length) return;
    if (ids.length > MAX_ORDERS_PER_PRINT) {
      this.toast.warning(`يمكن طباعة ${formatInteger(MAX_ORDERS_PER_PRINT)} طلب كحد أقصى في المرة الواحدة — صغّر حجم الصفحة أو ضيّق الفلاتر`);
      return;
    }
    const win = openPrintWindow(ids.length === 1 ? 'طباعة الطلب' : `طباعة ${formatInteger(ids.length)} طلب`);
    if (!win) {
      this.toast.error(POPUP_BLOCKED_MESSAGE);
      return;
    }
    from(ids)
      .pipe(
        mergeMap((id, index) => this.orders.get(id).pipe(map((o) => ({ index, o }))), PARALLEL_REQUESTS),
        toArray(),
      )
      .subscribe({
        next: (loaded) => writePrintWindow(win, ordersPrintHtml(loaded.sort((a, b) => a.index - b.index).map((x) => x.o))),
        error: () => win.close(),
      });
  }
}
