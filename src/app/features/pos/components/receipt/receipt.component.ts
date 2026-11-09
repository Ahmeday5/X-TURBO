import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input } from '@angular/core';
import { formatDateTime, formatMoney } from '../../../../shared/utils/format.util';

export interface ReceiptLine {
  name: string;
  qty: number;
  price: number;
  discountPct: number;
  total: number;
}

export interface ReceiptData {
  header: string;
  footer: string;
  number: string;
  /** ISO timestamp. */
  at: string;
  cashier: string;
  customer: string | null;
  warehouse: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  taxPct: number;
  tax: number;
  total: number;
  paid: number;
  change: number;
  remaining: number;
  methodLabel: string;
  paperWidth: 58 | 80;
}

/**
 * Paper-receipt styles. Kept as a plain string so the print window can use
 * the exact same rules. A receipt is a printed paper slip, so it uses fixed
 * ink-on-paper colours instead of the themed tokens (it must look the same
 * on screen in dark mode and on a thermal printer).
 */
export const RECEIPT_CSS = `
  .rc { width: var(--rc-w, 80mm); max-width: 100%; margin: 0 auto; padding: 14px 12px; background: #fff; color: #111;
        font: 12px/1.5 "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif; direction: rtl; box-sizing: border-box; }
  .rc--58 { --rc-w: 58mm; font-size: 11px; }
  .rc * { box-sizing: border-box; }
  .rc__head { text-align: center; white-space: pre-line; font-weight: 700; font-size: 1.1em; margin-bottom: 6px; }
  .rc__meta { display: grid; gap: 1px; font-size: 0.92em; padding-bottom: 6px; border-bottom: 1px dashed #999; }
  .rc__meta div { display: flex; justify-content: space-between; gap: 8px; }
  .rc__lines { width: 100%; border-collapse: collapse; margin: 6px 0; }
  .rc__lines th { font-size: 0.85em; font-weight: 600; text-align: start; border-bottom: 1px solid #111; padding: 2px 0; }
  .rc__lines td { padding: 3px 0; vertical-align: top; border-bottom: 1px dotted #ccc; }
  .rc__lines .n { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .rc__lines small { display: block; color: #555; font-size: 0.85em; }
  .rc__totals { display: grid; gap: 2px; padding-top: 4px; border-top: 1px dashed #999; }
  .rc__totals div { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; }
  .rc__grand { font-size: 1.25em; font-weight: 800; border-top: 1px solid #111; padding-top: 4px; margin-top: 2px; }
  .rc__foot { text-align: center; white-space: pre-line; margin-top: 10px; font-size: 0.9em; color: #333; }
  .rc__num { direction: ltr; unicode-bidi: isolate; }
`;

/** Printable sales receipt (preview on screen, `print()` for the printer). */
@Component({
  selector: 'app-pos-receipt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rc" [class.rc--58]="data().paperWidth === 58">
      @if (data().header) {<div class="rc__head">{{ data().header }}</div>}
      <div class="rc__meta">
        <div><span>رقم الفاتورة</span><span class="rc__num">{{ data().number }}</span></div>
        <div><span>التاريخ</span><span>{{ dateTime(data().at) }}</span></div>
        <div><span>الكاشير</span><span>{{ data().cashier }}</span></div>
        <div><span>العميل</span><span>{{ data().customer || 'عميل نقدي' }}</span></div>
        <div><span>الفرع</span><span>{{ data().warehouse }}</span></div>
      </div>
      <table class="rc__lines">
        <thead><tr><th>الصنف</th><th class="n">الكمية</th><th class="n">الإجمالي</th></tr></thead>
        <tbody>
          @for (l of data().lines; track $index) {
            <tr>
              <td>{{ l.name }}<small>{{ money(l.price) }}@if (l.discountPct) { — خصم {{ l.discountPct }}%}</small></td>
              <td class="n">{{ l.qty }}</td>
              <td class="n">{{ money(l.total) }}</td>
            </tr>
          }
        </tbody>
      </table>
      <div class="rc__totals">
        <div><span>الإجمالي قبل الخصم</span><span>{{ money(data().subtotal) }}</span></div>
        @if (data().discount) {<div><span>الخصم</span><span>− {{ money(data().discount) }}</span></div>}
        @if (data().tax) {<div><span>ضريبة القيمة المضافة {{ data().taxPct }}%</span><span>{{ money(data().tax) }}</span></div>}
        <div class="rc__grand"><span>الصافي</span><span>{{ money(data().total) }}</span></div>
        <div><span>طريقة الدفع</span><span>{{ data().methodLabel }}</span></div>
        <div><span>المدفوع</span><span>{{ money(data().paid + data().change) }}</span></div>
        @if (data().change) {<div><span>الباقي للعميل</span><span>{{ money(data().change) }}</span></div>}
        @if (data().remaining) {<div><span>المتبقي (آجل)</span><span>{{ money(data().remaining) }}</span></div>}
      </div>
      @if (data().footer) {<div class="rc__foot">{{ data().footer }}</div>}
    </div>
  `,
  styles: [':host { display: block; }', RECEIPT_CSS],
})
export class ReceiptComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly data = input.required<ReceiptData>();

  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;
  protected readonly width = computed(() => (this.data().paperWidth === 58 ? '58mm' : '80mm'));

  /** Prints only the receipt, in its own window sized to the paper. */
  print(): void {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) return;
    const html = this.host.querySelector('.rc')?.outerHTML ?? '';
    win.document.write(
      `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${this.data().number}</title>` +
        `<style>@page { size: ${this.width()} auto; margin: 0; } body { margin: 0; background: #fff; } ${RECEIPT_CSS}</style>` +
        `</head><body>${html}</body></html>`,
    );
    win.document.close();
    win.focus();
    // Give the window a frame to lay out before printing.
    setTimeout(() => {
      win.print();
      win.close();
    }, 150);
  }
}
