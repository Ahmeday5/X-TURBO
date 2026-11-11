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
  DocKind,
  Document,
  DOCUMENT_ERROR_CODES,
  docStatusView,
} from '../../models/document.model';
import { ApiError } from '../../../../core/models/api-response.model';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { DocumentsService } from '../../services/documents.service';
import { LINES_PLURAL, PAYMENT_STATE_VIEW, partyLabel, paymentState, tracksPayment } from '../../utils/document-view';
import { printDocument } from '../../utils/print-document';
import { convertTarget, DocAction, documentActions, isConvertAction, postVerb } from '../../utils/document-actions';
import { runDrawerIntent } from '../../../../shared/utils/drawer-intent.util';
import { todayIsoDate } from '../../../../shared/utils/date-iso.util';

type Busy = 'post' | 'complete' | 'cancel' | 'delete' | 'convert' | null;

/** What posting `d` does, for the confirmation dialog. */
function postConfirmMessage(d: Document): string {
  if (DOC_KIND_CONFIG[d.kind].stock === 'none') return 'بعد الاعتماد لا يمكن تعديل عرض السعر. هل تريد المتابعة؟';
  if (d.status === 'pending-review') {
    return `ستُضاف البضاعة إلى رصيد «${d.warehouseName}» وتُسجَّل القيود، ولا يمكن تعديل الفاتورة بعد التفعيل. هل تريد المتابعة؟`;
  }
  return 'بعد الترحيل تُطبَّق الحركة على المخزون والأرصدة ولا يمكن تعديل المستند. هل تريد المتابعة؟';
}

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
  protected readonly dayMonth = (iso: string) => formatDayMonth(iso.slice(0, 10));
  protected readonly statusView = docStatusView;
  protected readonly paymentLabel = DOC_PAYMENT_LABEL;
  protected readonly paymentView = (d: Document) => PAYMENT_STATE_VIEW[paymentState(d)];
  protected readonly tracksPayment = tracksPayment;
  protected readonly partyLabel = partyLabel;
  protected readonly linesLabel = (n: number) => pluralAr(n, LINES_PLURAL);
  protected readonly kindConfig = (k: DocKind) => DOC_KIND_CONFIG[k];
  protected readonly totalQty = (d: Document) => d.lines.reduce((s, l) => s + l.qty, 0);
  protected readonly overdue = (d: Document) =>
    !!d.dueDate && d.status === 'posted' && d.remaining > 0 && d.dueDate < todayIsoDate();

  /** Action requested from the table row — run once the document has loaded. */
  readonly intent = input<DocAction | null>(null);
  readonly intentDone = output<void>();

  /** The footer renders the same list as the table row's menu (one rule set). */
  protected readonly actions = computed(() => {
    const d = this.current();
    return d ? documentActions(d, d.lines.length > 0) : [];
  });

  constructor() {
    runDrawerIntent(this.current, this.intent, (d, action) => this.runAction(d, action), () => this.intentDone.emit());
  }

  /** Single entry for every action — footer button or table row. */
  protected runAction(d: Document, action: DocAction): void {
    if (!this.actions().some((a) => a.key === action)) {
      this.toast.info(`لم يعد هذا الإجراء متاحًا — حالة ${d.number} الآن «${docStatusView(d.kind, d.status).label}»`);
      return;
    }
    if (isConvertAction(action)) return this.convert(d, convertTarget(action));
    switch (action) {
      case 'post':
        return this.post(d);
      case 'edit':
        return this.edit.emit(d.id);
      case 'delete':
        return void this.remove(d);
      case 'complete':
        return this.complete(d);
      case 'cancel':
        return this.openCancel();
      case 'labels':
        return this.printLabels(d);
      case 'print':
        return this.print(d);
    }
  }

  /** Which footer button shows the spinner for the running request. */
  protected busyFor(action: DocAction): boolean {
    const busy = this.busy();
    return !!busy && (busy === action || (busy === 'convert' && isConvertAction(action)));
  }

  protected print(d: Document): void {
    printDocument(d);
  }

  /** One label per received unit, in the label-printing screen. */
  protected printLabels(d: Document): void {
    this.router.navigate(['/items/barcode-labels'], { queryParams: { doc: d.id } });
  }

  protected post(d: Document): void {
    const reviewed = d.status === 'pending-review';
    const success = reviewed
      ? `تم تفعيل ${d.number} واستلام البضاعة في ${d.warehouseName}`
      : d.kind === 'quotation'
        ? `تم اعتماد ${d.number}`
        : `تم ترحيل ${d.number}`;
    this.run('post', this.docs.post(d.id), success, { verb: postVerb(d), message: postConfirmMessage(d) });
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
    const what = d.status === 'draft' ? 'المسودة' : DOC_KIND_CONFIG[d.kind].singular;
    const ok = await this.dialog.confirm({
      title: `حذف ${what}`,
      message: `سيتم حذف ${what} ${d.number} نهائيًا. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    this.busy.set('delete');
    this.docs
      .delete(d.id)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: () => {
          this.toast.success(`تم حذف ${what} ${d.number}`);
          this.changed.emit();
          this.closed.emit();
        },
        error: (err: ApiError) => this.onActionError(d, err),
      });
  }

  /** Draft of `to` from this document, opened in its own screen's editor. */
  protected convert(d: Document, to: DocKind): void {
    this.busy.set('convert');
    this.docs
      .convert(d.id, to)
      .pipe(finalize(() => this.busy.set(null)))
      .subscribe({
        next: (draft) => {
          this.toast.success(`تم إنشاء ${DOC_KIND_CONFIG[to].singular} ${draft.number} كمسودة`);
          this.changed.emit();
          this.router.navigate([DOC_KIND_CONFIG[to].route], { queryParams: { doc: draft.id } });
        },
        error: (err: ApiError) => this.onActionError(d, err),
      });
  }

  /** Jump to a linked document (source / target) in its own screen. */
  protected openLinked(id: string): void {
    this.docs.get(id).subscribe((linked) => {
      this.router.navigate([DOC_KIND_CONFIG[linked.kind].route], { queryParams: { view: linked.id } });
    });
  }

  private async run(
    kind: Busy,
    request$: Observable<Document>,
    success: string,
    confirm?: { verb: string; message: string },
  ): Promise<void> {
    if (confirm) {
      const d = this.current()!;
      const ok = await this.dialog.confirm({
        title: `${confirm.verb} ${d.number}`,
        message: confirm.message,
        confirmText: confirm.verb,
        type: 'info',
      });
      if (!ok) return;
    }
    this.busy.set(kind);
    const d = this.current()!;
    request$.pipe(finalize(() => this.busy.set(null))).subscribe({
      next: () => {
        this.toast.success(success);
        this.doc.reload();
        this.changed.emit();
      },
      error: (err: ApiError) => this.onActionError(d, err),
    });
  }

  /**
   * One place for lifecycle failures. The server's message is always shown
   * as-is (it explains the rule). On a 409 the document's status may have
   * changed elsewhere (posted / cancelled by someone else), so it's reloaded
   * and the drawer re-renders with the actions that are actually allowed.
   */
  private onActionError(d: Document, err: ApiError): void {
    if (err.status === 409) {
      this.doc.reload();
      this.changed.emit();
    }
    if (hasErrorCode(err, DOCUMENT_ERROR_CODES.hasReturns) && d.targetId) {
      void this.offerOpenReturn(d, err.message);
      return;
    }
    this.toast.error(err.message);
  }

  /** Cancelling a document with an active return: the return must be cancelled first. */
  private async offerOpenReturn(d: Document, serverMessage: string): Promise<void> {
    const open = await this.dialog.confirm({
      title: `لا يمكن إلغاء ${d.number}`,
      message: `${serverMessage || 'على هذا المستند مرتجع نشط.'}\nألغِ المرتجع ${d.targetNumber ?? ''} أولًا، ثم أعد المحاولة.`,
      confirmText: 'فتح المرتجع',
      type: 'warning',
    });
    if (open && d.targetId) this.openLinked(d.targetId);
  }
}
