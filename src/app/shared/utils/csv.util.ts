export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number;
}

/**
 * Downloads rows as a UTF-8 CSV that Excel opens correctly with Arabic text
 * (BOM + CRLF, every cell quoted).
 */
export function downloadCsv<T>(filename: string, rows: readonly T[], columns: readonly CsvColumn<T>[]): void {
  const cell = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => cell(c.label)), ...rows.map((r) => columns.map((c) => cell(c.value(r))))];
  const blob = new Blob(['﻿' + lines.map((l) => l.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `${filename}.csv` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url));
}
