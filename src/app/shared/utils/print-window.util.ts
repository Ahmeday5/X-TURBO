/**
 * Opens the print window right away — it must happen synchronously inside the
 * click, or the browser blocks it as a popup once data loads asynchronously.
 * Shows a "preparing" note until the caller writes the real document.
 *
 * Returns `null` when popups are blocked.
 */
export function openPrintWindow(title: string, features = 'width=900,height=1000'): Window | null {
  const win = window.open('', '_blank', features);
  if (!win) return null;
  win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{margin:0;display:grid;place-items:center;height:100vh;font-family:"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;color:#555;background:#f5f5f5}</style>
</head><body>جارٍ تجهيز الطباعة…</body></html>`);
  win.document.close();
  return win;
}

/** Replaces the window's content with `html` (a full document); its own script triggers `print()`. */
export function writePrintWindow(win: Window, html: string): void {
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/** Longest wait for a print's images before printing anyway (slow network / dead link). */
export const PRINT_IMAGES_TIMEOUT_MS = 6000;

/**
 * `<script>` for a print document that holds `print()` until every `<img>`
 * has loaded or failed (capped at `PRINT_IMAGES_TIMEOUT_MS`), so photos are
 * never printed blank. A broken image is hidden rather than printed as an icon.
 */
export const PRINT_WHEN_IMAGES_READY_SCRIPT = `<script>
(function () {
  var printed = false;
  function go() { if (printed) return; printed = true; window.focus(); window.print(); }
  function settle(img) {
    return new Promise(function (done) {
      if (img.complete) { if (!img.naturalWidth) img.style.visibility = 'hidden'; return done(); }
      img.addEventListener('load', function () { done(); }, { once: true });
      img.addEventListener('error', function () { img.style.visibility = 'hidden'; done(); }, { once: true });
    });
  }
  window.addEventListener('load', function () {
    var imgs = Array.prototype.slice.call(document.images);
    Promise.all(imgs.map(settle)).then(go);
    setTimeout(go, ${PRINT_IMAGES_TIMEOUT_MS});
  });
})();
</script>`;

export const POPUP_BLOCKED_MESSAGE = 'المتصفح منع نافذة الطباعة — اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة';

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
