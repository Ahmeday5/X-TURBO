import { environment } from '../../../../environments/environment';
import { barcodeSvg } from '../../../shared/barcode/code128';
import { formatMoney } from '../../../shared/utils/format.util';
import { LabelFields, LabelRow, LabelTemplate, labelValue } from '../models/barcode-label.model';

const esc = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Markup of one label (shared by the on-screen preview and the print window). */
export function labelHtml(row: Pick<LabelRow, 'item'>, fields: LabelFields): string {
  const { item } = row;
  const value = labelValue(item);
  const svg = barcodeSvg(value);
  const meta = [fields.code ? `<span class="l-code">${esc(item.code)}</span>` : '', fields.brand && item.brand ? `<span>${esc(item.brand)}</span>` : '']
    .filter(Boolean)
    .join('<span class="l-sep">·</span>');

  return `<div class="l">
    ${fields.company ? `<div class="l-company">${esc(environment.appName)}</div>` : ''}
    ${fields.name ? `<div class="l-name">${esc(item.name)}</div>` : ''}
    <div class="l-bars">${svg ?? `<span class="l-missing">لا يمكن تحويل «${esc(value)}» إلى باركود</span>`}</div>
    ${fields.barcodeText ? `<div class="l-digits">${esc(value)}</div>` : ''}
    ${meta || fields.price ? `<div class="l-foot"><div class="l-meta">${meta}</div>${fields.price ? `<strong class="l-price">${esc(formatMoney(item.salePrice))}</strong>` : ''}</div>` : ''}
  </div>`;
}

/**
 * Label CSS sized in millimetres from the template — font sizes scale with the
 * label height so 25 mm and 40 mm labels both stay legible.
 */
export function labelCss(t: LabelTemplate): string {
  const h = t.height;
  const fs = (ratio: number) => `${Math.max(1.6, h * ratio).toFixed(2)}mm`;
  return `
  .l { box-sizing: border-box; width: ${t.width}mm; height: ${t.height}mm; padding: 1.2mm 1.6mm; overflow: hidden;
       display: flex; flex-direction: column; justify-content: center; gap: 0.4mm; background: #fff; color: #000;
       font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif; direction: rtl; text-align: center; }
  .l-company { font-size: ${fs(0.075)}; font-weight: 700; direction: ltr; }
  .l-name { font-size: ${fs(0.1)}; font-weight: 700; line-height: 1.15; max-height: 2.3em; overflow: hidden;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .l-bars { flex: 1 1 auto; min-height: ${(h * 0.3).toFixed(2)}mm; max-height: ${(h * 0.45).toFixed(2)}mm; display: flex; }
  .l-bars svg { width: 100%; height: 100%; }
  .l-missing { margin: auto; font-size: ${fs(0.07)}; color: #b00; }
  .l-digits { font: 600 ${fs(0.085)}/1 Consolas, "Cascadia Mono", monospace; letter-spacing: 0.3mm; direction: ltr; }
  .l-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 1mm; }
  .l-meta { font-size: ${fs(0.075)}; display: flex; gap: 0.8mm; min-width: 0; overflow: hidden; white-space: nowrap; }
  .l-code { direction: ltr; unicode-bidi: isolate; }
  .l-sep { opacity: 0.5; }
  .l-price { font-size: ${fs(0.11)}; white-space: nowrap; }`;
}

/**
 * Prints the queue in its own window, sized exactly for the label stock:
 * roll → one page per label (the printer driver's paper = the label);
 * sheet → A4 grid with the sheet's margins.
 */
export function printLabels(rows: readonly LabelRow[], template: LabelTemplate, fields: LabelFields): boolean {
  const labels = rows.flatMap((row) => Array.from({ length: row.copies }, () => labelHtml(row, fields)));
  if (!labels.length) return false;

  const win = window.open('', '_blank', 'width=900,height=900');
  if (!win) return false;

  const page =
    template.stock === 'roll'
      ? `@page { size: ${template.width}mm ${template.height}mm; margin: 0; }
         .page { display: block; }
         .l { page-break-after: always; break-after: page; }
         .l:last-child { page-break-after: auto; break-after: auto; }`
      : `@page { size: A4; margin: ${template.marginTop}mm ${template.marginSide}mm; }
         .page { display: grid; grid-template-columns: repeat(${template.columns}, ${template.width}mm);
                 grid-auto-rows: ${template.height}mm; column-gap: ${template.gapX}mm; row-gap: ${template.gapY}mm; }
         .l:nth-child(${(template.columns ?? 1) * (template.rows ?? 1)}n) { break-after: page; }`;

  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>ملصقات باركود — ${labels.length}</title>
<style>
  * { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { background: #fff; }
  ${labelCss(template)}
  ${page}
  @media screen { body { background: #e9e9e9; padding: 10mm; } .page { gap: 3mm; } .l { margin: 0 auto 3mm; outline: 1px dashed #aaa; } }
</style></head><body>
<main class="page">${labels.join('')}</main>
<script>window.onload = () => { window.focus(); window.print(); };</script>
</body></html>`);
  win.document.close();
  return true;
}
