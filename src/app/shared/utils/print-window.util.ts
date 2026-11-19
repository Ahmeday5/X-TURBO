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

export const POPUP_BLOCKED_MESSAGE = 'المتصفح منع نافذة الطباعة — اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة';

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
