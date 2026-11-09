import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DrawerComponent } from '../../../../shared/components/drawer/drawer.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { formatDateTime, formatDayMonth, formatInteger, formatMoney } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import {
  DOC_KIND_CONFIG,
  DOC_PAYMENT_LABEL,
  DOC_REASON_LABEL,
  DocKind,
  Document,
  docStatusView,
} from '../../models/document.model';
import { DocumentsService } from '../../services/documents.service';
import { LINES_PLURAL, PAYMENT_STATE_VIEW, partyLabel, paymentState, tracksPayment } from '../../utils/document-view';
import { printDocument } from '../../utils/print-document';

type Busy = 'post' | 'complete' | 'cancel' | 'delete' | 'convert' | null;

/** Read-only view of a document with the actions its status allows. */
@Component({
  selector: 'app-document-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, IconComponent, ModalComponent, StatusPillComponent],
  templateUrl: './document-drawer.component.html',
  styleUrl: './document-drawer.component.scss',
})
export class DocumentDrawerComponent {
  private readonly docs = inject(DocumentsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly docId = input<string | null>(null);

  readonly closed = output<void>();
  /** Something changed (status / deleted) — the list should reload. */
  readonly changed = output<void>();
  readonly edit = output<string>();

  protected readonly doc = createQueryResource(this.docId, (id) => this.docs.get(id!), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل المستند',
  });
  /** Ignore a stale document while switching to another id. */
  protected readonly current = computed(() => {
    const d = this.doc.value();
    return d && d.id === this.docId() ? d : null;
  });
  protected readonly cfg = computed(() => {
    const d = this.current();
    return d ? DOC_KIND_CONFIG[d.kind] : null;
  });

  protected readonly busy = signal<Busy>(null);
  protected readonly cancelOpen = signal(false);
  protected readonly cancelReason = signal('');

  protected readonly money = formatMoney;
  protected readonly int = formatInteger;
  protected readonly dateTime = formatDateTime;
  protected readonly dayMonth = (iso: string) => formatDayMonth(`${iso.slice(0, 10)}T12:00:00`);
  protected readonly statusView = docStatusView;
  protected readonly paymentLabel = DOC_PAYMENT_LABEL;
  protected readonly reasonLabel = DOC_REASON_LABEL;
  protected readonly paymentView = (d: Document) => PAYMENT_STATE_VIEW[paymentState(d)];
  protected readonly tracksPayment = tracksPayment;
  protected readonly partyLabel = partyLabel;
  protected readonly linesLabel = (n: number) => pluralAr(n, LINES_PLURAL);
  protected readonly kindConfig = (k: DocKind) => DOC_KIND_CONFIG[k];
  protected readonly totalQty = (d: Document) => d.lines.reduce((s, l) => s + l.qty, 0);
  protected readonly overdue = (d: Document) =>
    !!d.dueDate && d.status === 'posted' && d.remaining > 0 && d.dueDate < new Date().toISOString().slice(0, 10);

  protected print(d: Document): void {
    printDocument(d);
  }

  protected post(d: Document): void {
    const cfg = DOC_KIND_CONFIG[d.kind];
    this.run('post', this.docs.post(d.id), `تم ترحيل ${d.number}`, cfg.kind === 'quotation' ? 'اعتماد' : 'ترحيل');
  }

  protected complete(d: Document): void {
    this.run('complete', this.docs.complete(d.id), d.kind === 'reservation' ? 'تم التسليم وإصدار فاتورة البيع' : 'تم تأكيد الاستلام');
  }

  protected openCancel(): void {
    this.cancelReason.set('');
    this.cancelOpen.set(true);
  }

  protected confirmCancel(d: Document): void {
    this.cancelOpen.set(false);
    this.run('cancel', this.docs.cancel(d.id, this.cancelReason().trim()), `تم إلغاء ${d.number}`);
  }

  protected async remove(d: Document): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'حذف المسودة',
      message: `سيتم حذف المسودة ${d.number} نهائيًا. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    this.busy.set('delete');
    this.docs
      .delete(d.id)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe(() => {
        this.toast.success('تم حذف المسودة');
        this.changed.emit();
        this.closed.emit();
      });
  }

  /** Draft of `to` from this document, opened in its own screen's editor. */
  protected convert(d: Document, to: DocKind): void {
    this.busy.set('convert');
    this.docs
      .convert(d.id, to)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe((draft) => {
        this.toast.success(`تم إنشاء ${DOC_KIND_CONFIG[to].singular} ${draft.number} كمسودة`);
        this.changed.emit();
        this.router.navigate([DOC_KIND_CONFIG[to].route], { queryParams: { doc: draft.id } });
      });
  }

  /** Jump to a linked document (source / target) in its own screen. */
  protected openLinked(id: string): void {
    this.docs.get(id).subscribe((linked) => {
      this.router.navigate([DOC_KIND_CONFIG[linked.kind].route], { queryParams: { view: linked.id } });
    });
  }

  private async run(kind: Busy, request$: Observable<Document>, success: string, confirmVerb?: string): Promise<void> {
    if (confirmVerb) {
      const d = this.current()!;
      const ok = await this.dialog.confirm({
        title: `${confirmVerb} ${d.number}`,
        message:
          DOC_KIND_CONFIG[d.kind].stock === 'none'
            ? 'بعد الاعتماد لا يمكن تعديل عرض السعر. هل تريد المتابعة؟'
            : 'بعد الترحيل تُطبَّق الحركة على المخزون والأرصدة ولا يمكن تعديل المستند. هل تريد المتابعة؟',
        confirmText: confirmVerb,
        type: 'info',
      });
      if (!ok) return;
    }
    this.busy.set(kind);
    request$.pipe(finalize(() => this.busy.set(null))).subscribe(() => {
      this.toast.success(success);
      this.doc.reload();
      this.changed.emit();
    });
  }
}
