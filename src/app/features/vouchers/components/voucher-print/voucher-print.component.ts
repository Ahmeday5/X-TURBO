import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { formatLongDate, formatMoney } from '../../../../shared/utils/format.util';
import { Voucher, VOUCHER_KIND_CONFIG, VOUCHER_METHOD_LABEL, VOUCHER_STATUS_VIEW } from '../../models/voucher.model';

/**
 * Paper version of a voucher. Hidden on screen (`.print-only`, styles from
 * `<app-print-styles>`); the page sets it and calls `window.print()`.
 */
@Component({
  selector: 'app-voucher-print',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (voucher(); as v) {
      <article class="print-only vpr">
        <header class="vpr__head">
          <div>
            <h1>{{ appName }}</h1>
            <p>{{ cfg().singular }}</p>
          </div>
          <dl>
            <div><dt>رقم السند</dt><dd class="ltr">{{ v.number }}</dd></div>
            <div><dt>التاريخ</dt><dd>{{ date() }}</dd></div>
            <div><dt>الحالة</dt><dd>{{ status() }}</dd></div>
          </dl>
        </header>

        @if (v.kind === 'journal') {
          <p class="vpr__desc"><strong>البيان:</strong> {{ v.description }}</p>
          <table class="vpr__table">
            <thead><tr><th>الحساب</th><th>مركز التكلفة</th><th>البيان</th><th>مدين</th><th>دائن</th></tr></thead>
            <tbody>
              @for (l of v.lines; track $index) {
                <tr>
                  <td>{{ l.accountCode }} — {{ l.accountName }}</td>
                  <td>{{ l.costCenterName ?? '—' }}</td>
                  <td>{{ l.note || '—' }}</td>
                  <td>{{ l.debit ? money(l.debit) : '' }}</td>
                  <td>{{ l.credit ? money(l.credit) : '' }}</td>
                </tr>
              }
            </tbody>
            <tfoot><tr><td colspan="3">الإجمالي</td><td>{{ money(v.totalDebit) }}</td><td>{{ money(v.totalCredit) }}</td></tr></tfoot>
          </table>
        } @else {
          <div class="vpr__amount">{{ money(v.amount) }}</div>
          <table class="vpr__table vpr__table--fields">
            <tbody>
              <tr><th>{{ cfg().partyLabel }}</th><td>{{ v.partyName ?? v.accountName }}</td></tr>
              <tr><th>{{ cfg().direction === 'in' ? 'إلى خزينة' : 'من خزينة' }}</th><td>{{ v.cashAccountName }}</td></tr>
              <tr><th>طريقة الدفع</th><td>{{ v.method ? methodLabel[v.method] : '—' }}{{ v.reference ? ' — ' + v.reference : '' }}</td></tr>
              @if (v.costCenterName) {<tr><th>مركز التكلفة</th><td>{{ v.costCenterName }}</td></tr>}
              <tr><th>البيان</th><td>{{ v.description || '—' }}</td></tr>
            </tbody>
          </table>
        }

        <footer class="vpr__sign">
          <div><span>أعدّه</span><strong>{{ v.createdBy }}</strong></div>
          <div><span>المحاسب</span><strong>&nbsp;</strong></div>
          <div><span>{{ v.kind === 'receipt' ? 'المستلم منه' : v.kind === 'payment' ? 'المستلم' : 'المدير المالي' }}</span><strong>&nbsp;</strong></div>
        </footer>
      </article>
    }
  `,
  styles: [
    `
      :host { display: contents; }
      .vpr { color: #111; font-size: 13px; }
      .vpr__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding-bottom: 14px; border-bottom: 2px solid #111; }
      .vpr__head h1 { margin: 0; font-size: 22px; }
      .vpr__head p { margin: 4px 0 0; font-size: 16px; font-weight: 700; }
      .vpr__head dl { margin: 0; display: grid; gap: 4px; }
      .vpr__head dl div { display: flex; gap: 10px; }
      .vpr__head dt { color: #555; min-width: 70px; }
      .vpr__head dd { margin: 0; font-weight: 700; }
      .vpr__amount { margin: 18px 0; padding: 14px; border: 2px solid #111; border-radius: 10px; text-align: center; font-size: 24px; font-weight: 800; }
      .vpr__desc { margin: 16px 0 10px; }
      .vpr__table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      .vpr__table th, .vpr__table td { padding: 8px 10px; border: 1px solid #bbb; text-align: start; }
      .vpr__table thead th, .vpr__table tfoot td { background: #f1f1f1; font-weight: 700; }
      .vpr__table--fields th { width: 30%; background: #f7f7f7; }
      .vpr__sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 48px; }
      .vpr__sign div { display: flex; flex-direction: column; gap: 30px; text-align: center; }
      .vpr__sign span { color: #555; }
      .vpr__sign strong { border-top: 1px solid #111; padding-top: 6px; }
    `,
  ],
})
export class VoucherPrintComponent {
  readonly voucher = input<Voucher | null>(null);

  protected readonly appName = environment.appName;
  protected readonly money = formatMoney;
  protected readonly methodLabel = VOUCHER_METHOD_LABEL;
  protected readonly cfg = computed(() => VOUCHER_KIND_CONFIG[this.voucher()?.kind ?? 'receipt']);
  protected readonly date = computed(() => (this.voucher() ? formatLongDate(this.voucher()!.date.slice(0, 10)) : ''));
  protected readonly status = computed(() => (this.voucher() ? VOUCHER_STATUS_VIEW[this.voucher()!.status].label : ''));
}
