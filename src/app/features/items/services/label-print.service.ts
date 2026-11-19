import { inject, Injectable } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { formatInteger } from '../../../shared/utils/format.util';
import { openPrintWindow, POPUP_BLOCKED_MESSAGE } from '../../../shared/utils/print-window.util';
import { DocumentsService } from '../../documents/services/documents.service';
import { StockService } from '../../warehouses/services/stock.service';
import { LabelJobRow, MAX_COPIES, MAX_LABELS_PER_JOB, templateById } from '../models/barcode-label.model';
import { loadLabelSettings } from '../utils/label-settings';
import { printLabels } from '../utils/print-labels';

/**
 * One-click barcode labels from anywhere (items directory, purchase review…),
 * printed with this device's saved label template and fields — the labels
 * page is only needed to change those or to fine-tune copies.
 */
@Injectable({ providedIn: 'root' })
export class LabelPrintService {
  private readonly documents = inject(DocumentsService);
  private readonly stock = inject(StockService);
  private readonly toast = inject(ToastService);

  /** Prints the given rows now. Returns false when nothing was printed (and says why). */
  printItems(rows: readonly LabelJobRow[], target?: Window | null): boolean {
    const total = rows.reduce((sum, r) => sum + r.copies, 0);
    if (!total) {
      target?.close();
      this.toast.warning('لا توجد أصناف لطباعة ملصقاتها');
      return false;
    }
    if (total > MAX_LABELS_PER_JOB) {
      target?.close();
      this.toast.error(
        `عدد الملصقات ${formatInteger(total)} أكبر من الحد (${formatInteger(MAX_LABELS_PER_JOB)}) في المرة الواحدة — اطبعها من صفحة الملصقات على دفعات`,
      );
      return false;
    }
    const settings = loadLabelSettings();
    if (!printLabels(rows, templateById(settings.templateId), settings.fields, target)) {
      this.toast.error(POPUP_BLOCKED_MESSAGE);
      return false;
    }
    return true;
  }

  /**
   * One label per received unit of a document's lines (e.g. a purchase
   * invoice under review). Barcodes / prices come from the items catalogue;
   * lines of items no longer active are skipped and reported.
   */
  printDocument(docId: string): void {
    const win = openPrintWindow('ملصقات باركود');
    if (!win) {
      this.toast.error(POPUP_BLOCKED_MESSAGE);
      return;
    }
    forkJoin({ doc: this.documents.get(docId), catalogue: this.stock.itemLookup() }).subscribe({
      next: ({ doc, catalogue }) => {
        const byId = new Map(catalogue.map((i) => [i.id, i]));
        const rows: LabelJobRow[] = [];
        for (const line of doc.lines) {
          const item = byId.get(line.itemId);
          if (item) rows.push({ item, copies: Math.min(MAX_COPIES, Math.max(1, Math.round(line.qty))) });
        }
        const skipped = doc.lines.length - rows.length;
        if (this.printItems(rows, win) && skipped) {
          this.toast.info(`تم تخطي ${formatInteger(skipped)} صنف موقوف في ${doc.number}`);
        }
      },
      error: () => win.close(),
    });
  }
}
