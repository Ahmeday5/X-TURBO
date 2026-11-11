import { environment } from '../../../../environments/environment';
import { barcodeSvg } from '../../../shared/barcode/code128';
import { formatFullDate, formatInteger, formatMoney } from '../../../shared/utils/format.util';
import { DOC_KIND_CONFIG, DOC_PAYMENT_LABEL, Document, docStatusView } from '../models/document.model';
import { partyLabel, tracksPayment } from './document-view';

const esc = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const date = (iso: string | null) => (iso ? formatFullDate(iso.slice(0, 10)) : '—');

/**
 * Prints a clean A4 copy of a document in its own window, so nothing of the
 * app shell (drawer, sidebar, theme) leaks into the printout.
 */
export function printDocument(doc: Document): void {
  const cfg = DOC_KIND_CONFIG[doc.kind];
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return;

  const meta: Array<[string, string]> = [
    ['الرقم', doc.number],
    ['التاريخ', date(doc.date)],
  ];
  if (cfg.party) meta.push([partyLabel(cfg), doc.partyName ?? 'عميل نقدي']);
  meta.push([cfg.transfer ? 'من مخزن' : 'المخزن', doc.warehouseName]);
  if (cfg.transfer) meta.push(['إلى مخزن', doc.toWarehouseName ?? '—']);
  if (cfg.dueDateLabel && doc.dueDate) meta.push([cfg.dueDateLabel, date(doc.dueDate)]);
  if (doc.reference) meta.push(['المرجع', doc.reference]);
  if (tracksPayment(cfg) && doc.paymentMethod) meta.push(['طريقة الدفع', DOC_PAYMENT_LABEL[doc.paymentMethod]]);
  meta.push(['الحالة', docStatusView(doc.kind, doc.status).label]);

  // Scannable document number: a scan into the documents search box finds it again.
  const numberBarcode = barcodeSvg(doc.number);

  const priced = cfg.financial;
  const rows = doc.lines
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td><td class="ltr">${esc(l.code)}</td><td class="name">${esc(l.name)}</td>
        <td>${esc(l.unit)}</td><td>${formatInteger(l.qty)}</td>
        ${priced ? `<td>${esc(formatMoney(l.price))}</td><td>${l.discountPct ? `${l.discountPct}%` : '—'}</td><td>${esc(formatMoney(l.total))}</td>` : ''}
      </tr>`,
    )
    .join('');

  const totals = priced
    ? [
        ['الإجمالي قبل الخصم', formatMoney(doc.subtotal)],
        ...(doc.discount ? [['الخصم', formatMoney(doc.discount)]] : []),
        ...(doc.tax ? [[`ضريبة القيمة المضافة (${doc.taxPct}%)`, formatMoney(doc.tax)]] : []),
        ['الصافي', formatMoney(doc.total)],
        ...(doc.paid ? [[doc.kind === 'reservation' ? 'العربون' : 'المدفوع', formatMoney(doc.paid)]] : []),
        ...(doc.remaining && cfg.stock !== 'none' ? [['المتبقي', formatMoney(doc.remaining)]] : []),
      ]
    : [['إجمالي الكميات', formatInteger(doc.lines.reduce((s, l) => s + l.qty, 0))]];

  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${esc(cfg.singular)} ${esc(doc.number)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif; color: #111; margin: 0; font-size: 12px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #d9151d; padding-bottom: 12px; margin-bottom: 16px; }
  .brand { font-size: 22px; font-weight: 800; color: #d9151d; direction: ltr; }
  .head-end { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .doc-barcode { width: 56mm; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .doc-barcode svg { width: 100%; height: 11mm; }
  .doc-barcode span { font: 600 10px/1 Consolas, monospace; letter-spacing: 1px; direction: ltr; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { margin: 0; font-size: 20px; }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 18px; margin-bottom: 16px; }
  .meta div { border-bottom: 1px dashed #ccc; padding-bottom: 4px; }
  .meta small { display: block; color: #777; font-size: 10.5px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; }
  th { background: #f3f3f3; font-size: 11px; }
  td.name { text-align: start; }
  .totals { margin-top: 14px; margin-inline-start: auto; width: 300px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
  .totals div:last-child { font-weight: 800; }
  .notes { margin-top: 16px; padding: 10px; background: #f7f7f7; border-radius: 6px; white-space: pre-line; }
  .sign { display: flex; justify-content: space-between; margin-top: 48px; color: #555; }
  .sign span { border-top: 1px solid #999; padding-top: 6px; min-width: 160px; text-align: center; }
</style></head><body>
<header><div><h1>${esc(cfg.singular)}</h1><div class="ltr">${esc(doc.number)}</div></div>
<div class="head-end"><div class="brand">${esc(environment.appName)}</div>${numberBarcode ? `<div class="doc-barcode">${numberBarcode}<span>${esc(doc.number)}</span></div>` : ''}</div></header>
<section class="meta">${meta.map(([k, v]) => `<div><small>${esc(k)}</small>${esc(v)}</div>`).join('')}</section>
<table><thead><tr><th>#</th><th>الكود</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th>
${priced ? '<th>السعر</th><th>الخصم</th><th>الإجمالي</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>
<section class="totals">${totals.map(([k, v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</section>
${doc.notes ? `<div class="notes">${esc(doc.notes)}</div>` : ''}
<div class="sign"><span>المستلم</span><span>المسؤول — ${esc(doc.createdBy)}</span></div>
<script>window.onload = () => { window.print(); };</script>
</body></html>`);
  win.document.close();
}
