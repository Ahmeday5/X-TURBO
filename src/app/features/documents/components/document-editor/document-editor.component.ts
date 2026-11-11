import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, of, switchMap } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { plusDaysIsoDate, plusMonthsIsoDate, todayIsoDate } from '../../../../shared/utils/date-iso.util';
import { formatInteger, formatMoney } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { PartiesService } from '../../../parties/services/parties.service';
import { ItemLookup } from '../../../warehouses/models/stock.model';
import { StockService } from '../../../warehouses/services/stock.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import {
  DOC_KIND_CONFIG,
  DOC_PAYMENT_LABEL,
  DOC_PAYMENT_METHODS,
  DocKind,
  DocKindConfig,
  DocLinePayload,
  DocPaymentMethod,
  Document,
  DocumentPayload,
  docStatusView,
  docTotals,
  isOpenStatus,
  lineTotal,
} from '../../models/document.model';
import { ApiError } from '../../../../core/models/api-response.model';
import { applyServerErrors, RowErrors, splitIndexedErrors } from '../../../../core/utils/api-error.util';
import { DocumentsService } from '../../services/documents.service';
import { isOutgoing, LINES_PLURAL, newLabel, partyLabel, tracksPayment } from '../../utils/document-view';
import { ItemPickerComponent } from '../item-picker/item-picker.component';
import { SCAN_HINT, SCAN_ROW_PLACEHOLDER } from '../../../../shared/barcode/scan-hint.const';
import { findByScan } from '../../../../shared/barcode/scan-match';
import { ScanFeedbackService } from '../../../../shared/barcode/scan-feedback.service';

interface EditLine {
  key: number;
  itemId: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  discountPct: number;
}

let lineKey = 0;

/** Toast after a save — what happened to the document, in the kind's own words. */
function savedMessage(cfg: DocKindConfig, doc: Document, post: boolean): string {
  if (doc.status === 'pending-review') return `تم حفظ ${cfg.singular} ${doc.number} — بانتظار مراجعة مدير المخازن`;
  if (post) return `تم ${cfg.kind === 'quotation' ? 'اعتماد' : 'ترحيل'} ${cfg.singular} ${doc.number}`;
  return `تم حفظ ${doc.number} كمسودة`;
}

/**
 * Create / edit an open document (draft, or pending-review for review-flow
 * kinds) of any kind. Fields, prices, payment and stock checks all follow
 * DOC_KIND_CONFIG[kind]. `docId` = 'new' → create.
 * Emits `saved` with the stored document, or `locked` when asked to edit a
 * document that is no longer open.
 *
 * Review-flow kinds (purchase invoices) can't be posted from here: saving
 * sends them to the warehouse manager, who activates them.
 */
@Component({
  selector: 'app-document-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, FormErrorComponent, SearchableSelectComponent, StatusPillComponent, ItemPickerComponent],
  templateUrl: './document-editor.component.html',
  styleUrl: './document-editor.component.scss',
})
export class DocumentEditorComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly docs = inject(DocumentsService);
  private readonly stock = inject(StockService);
  private readonly parties = inject(PartiesService);
  private readonly toast = inject(ToastService);
  private readonly scanFeedback = inject(ScanFeedbackService);

  readonly kind = input.required<DocKind>();
  readonly docId = input.required<string>();

  readonly closed = output<void>();
  readonly saved = output<Document>();
  readonly locked = output<string>();

  protected readonly cfg = computed(() => DOC_KIND_CONFIG[this.kind()]);
  /** Saved documents go to the warehouse manager instead of being posted here. */
  protected readonly reviewFlow = computed(() => !!this.cfg().reviewFlow);
  protected readonly isNew = computed(() => this.docId() === 'new');
  protected readonly title = computed(() => (this.isNew() ? newLabel(this.kind()) : `تعديل ${this.cfg().singular}`));
  protected readonly partyLabel = computed(() => partyLabel(this.cfg()));
  protected readonly tracksPayment = computed(() => tracksPayment(this.cfg()));
  protected readonly outgoing = computed(() => isOutgoing(this.cfg()));
  protected readonly methods = DOC_PAYMENT_METHODS.filter((m) => m !== 'credit');
  protected readonly methodLabel = DOC_PAYMENT_LABEL;

  protected readonly form = this.fb.group({
    date: [todayIsoDate(), Validators.required],
    dueDate: [''],
    partyId: [''],
    warehouseId: ['', Validators.required],
    toWarehouseId: [''],
    reference: ['', Validators.maxLength(80)],
    paymentMethod: ['cash' as DocPaymentMethod],
    discount: [0, Validators.min(0)],
    taxPct: [0, [Validators.min(0), Validators.max(100)]],
    paid: [0, Validators.min(0)],
    notes: ['', Validators.maxLength(500)],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private readonly value = computed(() => ({ ...this.form.getRawValue(), ...this.values() }));

  protected readonly lines = signal<EditLine[]>([]);
  /** Settle the whole amount now (cash / card sale). Off → credit or partial. */
  protected readonly payFull = signal(true);
  protected readonly current = signal<Document | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal<'draft' | 'post' | null>(null);
  protected readonly submitted = signal(false);

  // ── Lookups ──

  protected readonly warehouses = toSignal(inject(WarehousesService).lookup(), { initialValue: [] });
  protected readonly warehouseOptions = computed<SearchableSelectOption[]>(() =>
    this.warehouses().map((w) => ({ value: w.id, label: w.name, hint: w.isDefault ? 'افتراضي' : undefined })),
  );
  protected readonly toWarehouseOptions = computed(() =>
    this.warehouseOptions().filter((w) => w.value !== this.value().warehouseId),
  );

  private readonly partyList = toSignal(
    toObservable(this.cfg).pipe(switchMap((cfg) => (cfg.party ? this.parties.lookup(cfg.party) : of([])))),
    { initialValue: [] },
  );
  protected readonly partyOptions = computed<SearchableSelectOption[]>(() =>
    this.partyList().map((p) => ({ value: p.id, label: p.name, hint: p.phone || p.code })),
  );
  protected readonly party = computed(() => this.partyList().find((p) => p.id === this.value().partyId) ?? null);

  private readonly warehouseId = computed(() => this.value().warehouseId);
  protected readonly itemsLoading = signal(true);
  protected readonly items = toSignal(
    toObservable(this.warehouseId).pipe(
      switchMap((id) => {
        this.itemsLoading.set(true);
        return (id ? this.stock.itemLookup(id) : of<ItemLookup[]>([])).pipe(finalize(() => this.itemsLoading.set(false)));
      }),
    ),
    { initialValue: [] as ItemLookup[] },
  );
  private readonly itemMap = computed(() => new Map(this.items().map((i) => [i.id, i])));

  protected readonly priceOf = (item: ItemLookup): number =>
    this.cfg().priceSource === 'sale' ? item.salePrice : item.purchasePrice;

  // ── Totals ──

  protected readonly totals = computed(() => {
    const v = this.value();
    const base = docTotals(this.lines(), Number(v.discount) || 0, Number(v.taxPct) || 0, 0);
    const paid = !this.cfg().financial || this.cfg().stock === 'none' ? 0 : this.tracksPayment() && this.payFull() ? base.total : Math.min(Number(v.paid) || 0, base.total);
    return { ...base, paid, remaining: Math.max(Math.round((base.total - paid) * 100) / 100, 0) };
  });
  protected readonly totalQty = computed(() => this.lines().reduce((s, l) => s + (Number(l.qty) || 0), 0));
  protected readonly linesLabel = computed(() => pluralAr(this.lines().length, LINES_PLURAL));

  /** Lines asking for more than the source warehouse holds (outgoing kinds). */
  protected readonly shortLines = computed(() => {
    if (!this.outgoing()) return new Set<number>();
    const need = new Map<string, number>();
    for (const l of this.lines()) need.set(l.itemId, (need.get(l.itemId) ?? 0) + (Number(l.qty) || 0));
    return new Set(
      this.lines()
        .filter((l) => (need.get(l.itemId) ?? 0) > (this.itemMap().get(l.itemId)?.available ?? 0))
        .map((l) => l.key),
    );
  });

  /** Credit customers: does this invoice push the balance past the limit? */
  protected readonly creditWarning = computed(() => {
    const p = this.party();
    if (this.kind() !== 'sale' || !p?.creditLimit) return null;
    const after = p.balance + this.totals().remaining;
    return after > p.creditLimit ? { limit: p.creditLimit, after } : null;
  });

  protected readonly money = formatMoney;
  protected readonly int = formatInteger;
  protected readonly statusView = docStatusView;

  constructor() {
    effect(() => {
      const id = this.docId();
      const kind = this.kind();
      untracked(() => (id === 'new' ? this.reset(kind) : this.load(id)));
    });

    // Default warehouse once the lookup arrives (create mode).
    effect(() => {
      const list = this.warehouses();
      untracked(() => {
        if (!this.form.controls.warehouseId.value && list.length) {
          this.form.controls.warehouseId.setValue((list.find((w) => w.isDefault) ?? list[0]).id);
        }
      });
    });

    // Destination can't equal the source.
    effect(() => {
      const from = this.value().warehouseId;
      untracked(() => {
        if (from && this.form.controls.toWarehouseId.value === from) this.form.controls.toWarehouseId.setValue('');
      });
    });
  }

  @HostListener('document:keydown.control.s', ['$event'])
  protected onSaveShortcut(event: Event): void {
    event.preventDefault();
    if (!this.saving()) this.submit(false);
  }

  // ── Lines ──

  /** Adds a line, or +1 on the item's existing line (scanning the same item again). Returns the line's key. */
  protected addItem(item: ItemLookup): number {
    const existing = this.lines().find((l) => l.itemId === item.id);
    if (existing) {
      this.patchLine(existing.key, { qty: (Number(existing.qty) || 0) + 1 });
      this.flash(existing.key);
      return existing.key;
    }
    const key = ++lineKey;
    this.lines.update((ls) => [
      ...ls,
      { key, itemId: item.id, code: item.code, name: item.name, unit: item.unit, qty: 1, price: this.priceOf(item), discountPct: 0 },
    ]);
    this.flash(key);
    return key;
  }

  // ── Scan row ──

  protected readonly scanHint = SCAN_HINT;
  protected readonly scanRowPlaceholder = SCAN_ROW_PLACEHOLDER;
  /** Why the last scan added nothing (cleared on the next keystroke). */
  protected readonly scanMiss = signal<string | null>(null);
  /** Confirmation of the last successful scan ("+1 · تيل فرامل — الكمية 3"). */
  protected readonly lastScanned = signal<string | null>(null);
  /** Line briefly highlighted after it was added / incremented. */
  protected readonly flashKey = signal<number | null>(null);
  private flashTimer?: ReturnType<typeof setTimeout>;

  /**
   * Enter in the scan row (a scanner sends the full code + Enter): exact
   * barcode / code / SKU only → add the item or +1 its line. The box is
   * cleared and keeps focus, so the next scan needs no click.
   */
  protected onScan(box: HTMLInputElement, event: Event): void {
    event.preventDefault();
    const raw = box.value.trim();
    if (!raw) return;
    const item = findByScan(this.items(), raw);
    box.value = '';
    if (!item) {
      this.lastScanned.set(null);
      this.scanMiss.set(`لا يوجد صنف بالباركود أو الكود «${raw}» — تأكد من الملصق أو ابحث بالاسم من الأعلى`);
      this.scanFeedback.miss();
      return;
    }
    const key = this.addItem(item);
    const qty = this.lines().find((l) => l.key === key)?.qty ?? 1;
    this.scanMiss.set(null);
    this.lastScanned.set(`${item.name} — الكمية ${this.int(Number(qty) || 1)}`);
    this.scanFeedback.ok();
  }

  private flash(key: number): void {
    this.flashKey.set(key);
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flashKey.set(null), 900);
  }

  protected patchLine(key: number, patch: Partial<EditLine>): void {
    this.lines.update((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    this.clearLineErrors(key, Object.keys(patch));
  }

  protected setNumber(key: number, field: 'qty' | 'price' | 'discountPct', raw: string): void {
    const n = Number(raw);
    this.patchLine(key, { [field]: Number.isFinite(n) ? n : 0 });
  }

  protected removeLine(key: number): void {
    this.lines.update((ls) => ls.filter((l) => l.key !== key));
    this.clearLineErrors(key);
  }

  // ── Server validation on lines (422 `lines[i].field`) ──

  /** Server messages per line, keyed by the line's stable `key` (not its index). */
  protected readonly lineErrors = signal<ReadonlyMap<number, RowErrors>>(new Map());

  protected lineError(key: number, field: keyof DocLinePayload): string | null {
    return this.lineErrors().get(key)?.[field] ?? null;
  }

  /** Header errors → form controls; `lines[i].x` → the line that was sent at index i. */
  private showServerErrors(err: ApiError, sentLines: readonly EditLine[]): void {
    const { rows, rest } = splitIndexedErrors(err.fieldErrors, 'lines');
    const byKey = new Map<number, RowErrors>();
    rows.forEach((fields, index) => {
      const line = sentLines[index];
      if (line) byKey.set(line.key, fields);
    });
    this.lineErrors.set(byKey);
    applyServerErrors(this.form, { ...err, fieldErrors: rest });
  }

  /** Drop a line's errors (all, or only the edited fields). */
  private clearLineErrors(key: number, fields?: readonly string[]): void {
    const current = this.lineErrors().get(key);
    if (!current) return;
    const next = new Map(this.lineErrors());
    const remaining = fields ? Object.fromEntries(Object.entries(current).filter(([f]) => !fields.includes(f))) : {};
    if (Object.keys(remaining).length) next.set(key, remaining);
    else next.delete(key);
    this.lineErrors.set(next);
  }

  protected lineTotal(l: EditLine): number {
    return lineTotal(Number(l.qty) || 0, Number(l.price) || 0, Number(l.discountPct) || 0);
  }

  protected available(itemId: string): number | null {
    return this.itemMap().get(itemId)?.available ?? null;
  }

  // ── Payment ──

  protected setPayFull(full: boolean): void {
    this.payFull.set(full);
    const method = this.form.controls.paymentMethod;
    if (full && method.value === 'credit') method.setValue('cash');
    if (!full) this.form.controls.paid.setValue(0);
  }

  // ── Save ──

  protected submit(postRequested: boolean): void {
    this.submitted.set(true);
    const cfg = this.cfg();
    // The server ignores `post` for review-flow kinds; never ask for it.
    const post = postRequested && !this.reviewFlow();
    const v = this.form.getRawValue();
    const problem =
      this.form.invalid
        ? 'راجع الحقول المطلوبة'
        : cfg.partyRequired && !v.partyId
          ? `اختر ${this.partyLabel()}`
          : cfg.transfer && !v.toWarehouseId
            ? 'اختر المخزن المستلم'
            : !this.lines().length
              ? 'أضف صنفًا واحدًا على الأقل'
              : this.lines().some((l) => !(Number(l.qty) > 0))
                ? 'الكميات يجب أن تكون أكبر من صفر'
                : this.tracksPayment() && this.totals().remaining > 0 && !v.partyId
                  ? `البيع الآجل يتطلب تحديد ${this.partyLabel()}`
                  : null;
    if (problem) {
      this.form.markAllAsTouched();
      this.toast.warning(problem);
      return;
    }

    const totals = this.totals();
    const payload: DocumentPayload = {
      kind: this.kind(),
      date: v.date,
      dueDate: cfg.dueDateLabel ? v.dueDate || null : null,
      partyId: cfg.party ? v.partyId || null : null,
      warehouseId: v.warehouseId,
      toWarehouseId: cfg.transfer ? v.toWarehouseId || null : null,
      reference: v.reference.trim(),
      reason: null,
      paymentMethod: cfg.financial && cfg.stock !== 'none' ? (totals.paid <= 0 && totals.remaining > 0 ? 'credit' : v.paymentMethod) : null,
      lines: this.lines().map((l) => ({ itemId: l.itemId, qty: Number(l.qty), price: Number(l.price) || 0, discountPct: Number(l.discountPct) || 0 })),
      discount: cfg.financial ? Number(v.discount) || 0 : 0,
      taxPct: cfg.financial ? Number(v.taxPct) || 0 : 0,
      paid: totals.paid,
      notes: v.notes.trim(),
      post,
    };

    const id = this.current()?.id;
    const sentLines = this.lines();
    this.lineErrors.set(new Map());
    this.saving.set(post ? 'post' : 'draft');
    (id ? this.docs.update(id, payload) : this.docs.create(payload))
      .pipe(finalize(() => this.saving.set(null)))
      .subscribe({
        next: (doc) => {
          this.toast.success(savedMessage(cfg, doc, post));
          this.saved.emit(doc);
        },
        // 422 → under each field / line. 409s (e.g. CREDIT_LIMIT_EXCEEDED,
        // DOCUMENT_NOT_DRAFT) are toasted verbatim by the error interceptor.
        error: (err: ApiError) => this.showServerErrors(err, sentLines),
      });
  }

  // ── Load / reset ──

  private load(id: string): void {
    this.loading.set(true);
    this.docs
      .get(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (doc) => {
          if (!isOpenStatus(doc.status)) {
            this.toast.info(`${doc.number} «${docStatusView(doc.kind, doc.status).label}» — لا يمكن تعديله`);
            this.locked.emit(doc.id);
            return;
          }
          this.current.set(doc);
          this.form.reset({
            date: doc.date,
            dueDate: doc.dueDate ?? '',
            partyId: doc.partyId ?? '',
            warehouseId: doc.warehouseId,
            toWarehouseId: doc.toWarehouseId ?? '',
            reference: doc.reference,
            paymentMethod: doc.paymentMethod && doc.paymentMethod !== 'credit' ? doc.paymentMethod : 'cash',
            discount: doc.discount,
            taxPct: doc.taxPct,
            paid: doc.paid,
            notes: doc.notes,
          });
          this.payFull.set(doc.total > 0 && doc.remaining <= 0);
          this.lines.set(
            doc.lines.map((l) => ({ key: ++lineKey, itemId: l.itemId, code: l.code, name: l.name, unit: l.unit, qty: l.qty, price: l.price, discountPct: l.discountPct })),
          );
          this.submitted.set(false);
        },
        error: () => this.closed.emit(),
      });
  }

  private reset(kind: DocKind): void {
    const cfg = DOC_KIND_CONFIG[kind];
    const purchaseSide = cfg.party === 'supplier';
    const defaultWh = this.warehouses().find((w) => w.isDefault) ?? this.warehouses()[0];
    this.current.set(null);
    this.lines.set([]);
    this.submitted.set(false);
    this.payFull.set(kind === 'sale' || kind === 'sale-return' || kind === 'purchase-return');
    this.form.reset({
      date: todayIsoDate(),
      dueDate:
        kind === 'quotation' ? plusDaysIsoDate(14) : kind === 'reservation' ? plusDaysIsoDate(3) : kind === 'purchase' ? plusMonthsIsoDate(1) : '',
      partyId: '',
      warehouseId: defaultWh?.id ?? '',
      toWarehouseId: '',
      reference: '',
      paymentMethod: kind === 'purchase' ? 'bank' : 'cash',
      discount: 0,
      taxPct: purchaseSide ? 14 : 0,
      paid: 0,
      notes: '',
    });
  }
}
