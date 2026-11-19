import { environment } from '../../../../environments/environment';
import { barcodeSvg } from '../../../shared/barcode/code128';
import { formatDateTime, formatInteger, formatMoney } from '../../../shared/utils/format.util';
import { escapeHtml as esc } from '../../../shared/utils/print-window.util';
import { toLocalMobile } from '../../../shared/utils/phone.util';
import { CHANNEL_LABEL, Order, ORDER_STATUS_VIEW, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_VIEW } from '../models/order.model';

/** Cash still to be collected at the door (shown big for the driver). */
const toCollect = (o: Order): number => (o.paymentStatus === 'unpaid' ? o.total : 0);

function orderPage(o: Order): string {
  const numberBarcode = barcodeSvg(o.number);
  const driver = o.driver?.name ?? o.driverName;
  const driverPhone = o.driver?.phone;
  const collect = toCollect(o);

  const meta: Array<[string, string]> = [
    ['التاريخ', formatDateTime(o.createdAt)],
    ['القناة', CHANNEL_LABEL[o.channel]],
    ['الحالة', ORDER_STATUS_VIEW[o.status].label],
    ['طريقة الدفع', PAYMENT_METHOD_LABEL[o.paymentMethod]],
    ['حالة الدفع', PAYMENT_STATUS_VIEW[o.paymentStatus].label],
    ['عدد القطع', formatInteger(o.itemCount)],
  ];

  const rows = o.lines
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td><td class="ltr">${esc(l.code)}</td><td class="name">${esc(l.name)}</td>
        <td>${formatInteger(l.qty)}</td><td>${esc(formatMoney(l.unitPrice))}</td><td>${esc(formatMoney(l.total))}</td>
      </tr>`,
    )
    .join('');

  const totals: Array<[string, string]> = [
    ['المجموع الفرعي', formatMoney(o.subtotal)],
    ...(o.discount ? ([['الخصم', `−${formatMoney(o.discount)}`]] as Array<[string, string]>) : []),
    ...(o.shipping ? ([['الشحن', formatMoney(o.shipping)]] as Array<[string, string]>) : []),
    ['الإجمالي', formatMoney(o.total)],
  ];

  return `<section class="order">
<header>
  <div><h1>طلب ${esc(o.number)}</h1><div class="sub">${esc(formatDateTime(o.createdAt))}</div></div>
  <div class="head-end"><div class="brand">${esc(environment.appName)}</div>
  ${numberBarcode ? `<div class="doc-barcode">${numberBarcode}<span>${esc(o.number)}</span></div>` : ''}</div>
</header>

<div class="parties">
  <div class="box">
    <small>العميل</small>
    <strong>${esc(o.customerName)}</strong>
    <div class="ltr">${esc(toLocalMobile(o.customerPhone))}</div>
    <div>${esc([o.address, o.city].filter(Boolean).join(' — '))}</div>
  </div>
  <div class="box">
    <small>المندوب</small>
    ${driver ? `<strong>${esc(driver)}</strong>${driverPhone ? `<div class="ltr">${esc(toLocalMobile(driverPhone))}</div>` : ''}` : '<strong class="muted">لم يُعيَّن</strong>'}
  </div>
  <div class="box collect ${collect ? '' : 'paid'}">
    <small>${collect ? 'المطلوب تحصيله' : 'الدفع'}</small>
    <strong>${collect ? esc(formatMoney(collect)) : 'مدفوع'}</strong>
  </div>
</div>

<section class="meta">${meta.map(([k, v]) => `<div><small>${esc(k)}</small>${esc(v)}</div>`).join('')}</section>

<table><thead><tr><th>#</th><th>الكود</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
<tbody>${rows}</tbody></table>
<section class="totals">${totals.map(([k, v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</section>
${o.note ? `<div class="notes"><small>ملاحظة العميل</small>${esc(o.note)}</div>` : ''}
<div class="sign"><span>توقيع المستلم</span><span>توقيع المندوب</span></div>
</section>`;
}

/**
 * A4 printout of one or more orders — one page each — for packing and for
 * the driver (customer, address, amount to collect, signatures).
 */
export function ordersPrintHtml(orders: readonly Order[]): string {
  const title = orders.length === 1 ? `طلب ${orders[0].number}` : `${formatInteger(orders.length)} طلب`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif; color: #111; margin: 0; font-size: 12px; }
  .order { break-after: page; page-break-after: always; }
  .order:last-child { break-after: auto; page-break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #d9151d; padding-bottom: 10px; margin-bottom: 14px; }
  h1 { margin: 0; font-size: 20px; direction: rtl; }
  .sub { color: #666; margin-top: 4px; }
  .brand { font-size: 22px; font-weight: 800; color: #d9151d; direction: ltr; }
  .head-end { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .doc-barcode { width: 56mm; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .doc-barcode svg { width: 100%; height: 11mm; }
  .doc-barcode span { font: 600 10px/1 Consolas, monospace; letter-spacing: 1px; direction: ltr; }
  .ltr { direction: ltr; unicode-bidi: isolate; text-align: right; }
  .parties { display: grid; grid-template-columns: 2fr 1.2fr 1fr; gap: 10px; margin-bottom: 12px; }
  .box { border: 1px solid #ddd; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 3px; }
  .box small, .meta small, .notes small { display: block; color: #777; font-size: 10.5px; }
  .box strong { font-size: 14px; }
  .muted { color: #999; }
  .collect { border: 2px solid #111; align-items: center; justify-content: center; text-align: center; }
  .collect strong { font-size: 18px; }
  .collect.paid { border: 1px dashed #999; }
  .meta { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px 14px; margin-bottom: 14px; }
  .meta div { border-bottom: 1px dashed #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; }
  th { background: #f3f3f3; font-size: 11px; }
  td.name { text-align: start; }
  .totals { margin-top: 12px; margin-inline-start: auto; width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
  .totals div:last-child { font-weight: 800; font-size: 14px; }
  .notes { margin-top: 14px; padding: 10px; background: #f7f7f7; border-radius: 6px; white-space: pre-line; }
  .sign { display: flex; justify-content: space-between; margin-top: 40px; color: #555; }
  .sign span { border-top: 1px solid #999; padding-top: 6px; min-width: 170px; text-align: center; }
</style></head><body>
${orders.map(orderPage).join('\n')}
<script>window.onload = () => { window.focus(); window.print(); };</script>
</body></html>`;
}
