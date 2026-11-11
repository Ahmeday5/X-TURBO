import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, startWith, Subject, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SCAN_HINT, SCAN_PLACEHOLDER } from '../../../../shared/barcode/scan-hint.const';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { matchesAll, normalizeArabic, tokenize } from '../../../../shared/utils/arabic-search.util';
import { todayIsoDate } from '../../../../shared/utils/date-iso.util';
import { formatMoney, formatRelative } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { DOC_PAYMENT_LABEL, docTotals, lineTotal } from '../../../documents/models/document.model';
import { DocumentsService } from '../../../documents/services/documents.service';
import { PartyOption } from '../../../parties/models/party.model';
import { PartiesService } from '../../../parties/services/parties.service';
import { ItemLookup } from '../../../warehouses/models/stock.model';
import { StockService } from '../../../warehouses/services/stock.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { ReceiptComponent, ReceiptData } from '../../components/receipt/receipt.component';
import { CartLine, toCartLine } from '../../models/pos-cart.model';
import { POS_PAYMENT_METHODS, PosPaymentMethod } from '../../models/pos-settings.model';
import { ApiError } from '../../../../core/models/api-response.model';
import { AppValidators, validationMessage } from '../../../../shared/validators/app-validators';
import { HeldCartsService } from '../../services/held-carts.service';
import { PosSettingsService } from '../../services/pos-settings.service';

const ITEMS_PLURAL = { one: 'صنف واحد', two: 'صنفان', few: '# أصناف', other: '# صنف' };
const WALK_IN = '';

/**
 * Cashier screen: catalogue (search / barcode / group chips) beside a cart
 * with discounts, VAT, customer and payment. Checkout posts a POS sale and
 * shows a printable receipt. F2 → search, F9 → checkout, Esc → clear search.
 */
@Component({
  selector: 'app-pos-terminal-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageHeaderComponent, IconComponent, ModalComponent, SearchableSelectComponent, ReceiptComponent],
  templateUrl: './pos-terminal.page.html',
  styleUrl: './pos-terminal.page.scss',
})
export class PosTerminalPage {
  protected readonly scanHint = SCAN_HINT;
  protected readonly scanPlaceholder = SCAN_PLACEHOLDER;
  private readonly stock = inject(StockService);
  private readonly docs = inject(DocumentsService);
  private readonly parties = inject(PartiesService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  protected readonly held = inject(HeldCartsService);

  readonly navId = input.required<string>();

  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');
  private readonly receiptView = viewChild<ReceiptComponent>('receiptView');

  // ── Settings & sources ──

  /**
   * Re-fetched after a rejected checkout: the server enforces the CURRENT
   * settings (discount cap, enabled payment methods), which an admin may have
   * changed since this terminal opened.
   */
  private readonly reloadSettings$ = new Subject<void>();
  private readonly posSettings = inject(PosSettingsService);
  protected readonly settings = toSignal(
    this.reloadSettings$.pipe(
      startWith(undefined),
      switchMap(() => this.posSettings.get()),
    ),
  );
  private readonly warehouses = toSignal(inject(WarehousesService).lookup(), { initialValue: [] });

  protected readonly warehouse = computed(() => {
    const s = this.settings();
    const list = this.warehouses();
    if (!s || !list.length) return null;
    return list.find((w) => w.id === s.warehouseId) ?? list.find((w) => w.isDefault) ?? list[0];
  });

  private readonly itemsQuery = computed(() => this.warehouse()?.id ?? null);
  protected readonly items = createQueryResource(this.itemsQuery, (id) => this.stock.itemLookup(id), {
    enabled: (id) => !!id,
    errorMessage: 'تعذّر تحميل الأصناف',
  });

  private readonly refreshCustomers$ = new Subject<void>();
  protected readonly customers = toSignal(
    this.refreshCustomers$.pipe(
      startWith(undefined),
      switchMap(() => this.parties.lookup('customer')),
    ),
    { initialValue: [] as PartyOption[] },
  );
  protected readonly customerOptions = computed<SearchableSelectOption[]>(() => [
    { value: WALK_IN, label: 'عميل نقدي (بدون تسجيل)' },
    ...this.customers().map((c) => ({ value: c.id, label: c.name, hint: c.phone })),
  ]);

  // ── Catalogue ──

  protected readonly term = signal('');
  protected readonly groupId = signal<string | null>(null);

  protected readonly groups = computed(() => {
    const map = new Map<string, { id: string; name: string; color: string; count: number }>();
    for (const i of this.items.value() ?? []) {
      const g = map.get(i.groupId) ?? { id: i.groupId, name: i.groupName, color: i.groupColor, count: 0 };
      g.count++;
      map.set(i.groupId, g);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  });

  protected readonly visibleItems = computed(() => {
    const tokens = tokenize(this.term());
    const group = this.groupId();
    return (this.items.value() ?? [])
      .filter((i) => (!group || i.groupId === group) && matchesAll([i.name, i.code, i.barcode, i.brand], tokens))
      .sort((a, b) => Number(b.available > 0) - Number(a.available > 0));
  });

  // ── Cart ──

  protected readonly cart = signal<CartLine[]>([]);
  protected readonly customerId = signal<string>(WALK_IN);
  protected readonly method = signal<PosPaymentMethod>('cash');
  protected readonly discount = signal(0);
  protected readonly taxPct = signal<number | null>(null);
  protected readonly tendered = signal<number | null>(null);
  protected readonly checkingOut = signal(false);

  protected readonly customer = computed(() => this.customers().find((c) => c.id === this.customerId()) ?? null);
  protected readonly methods = computed(() => {
    const allowed = this.settings()?.paymentMethods ?? POS_PAYMENT_METHODS;
    return POS_PAYMENT_METHODS.filter((m) => allowed.includes(m));
  });
  protected readonly effectiveTax = computed(() => this.taxPct() ?? this.settings()?.defaultTaxPct ?? 0);
  protected readonly allowDiscount = computed(() => this.settings()?.allowDiscount ?? false);
  protected readonly maxDiscount = computed(() => (this.allowDiscount() ? (this.settings()?.maxDiscountPct ?? 0) : 0));

  protected readonly totals = computed(() =>
    docTotals(this.cart(), this.discount(), this.effectiveTax(), 0),
  );
  protected readonly itemCount = computed(() => this.cart().reduce((s, l) => s + l.qty, 0));
  protected readonly change = computed(() => {
    const t = this.tendered();
    return this.method() === 'cash' && t !== null ? Math.max(0, Math.round((t - this.totals().total) * 100) / 100) : 0;
  });
  /** Amount still owed after the tender (credit sales and short cash). */
  protected readonly shortfall = computed(() => {
    const t = this.tendered();
    if (this.method() === 'credit') return Math.max(0, this.totals().total - (t ?? 0));
    if (this.method() === 'cash' && t !== null) return Math.max(0, this.totals().total - t);
    return 0;
  });

  protected readonly problems = computed<string[]>(() => {
    const out: string[] = [];
    if (!this.cart().length) return out;
    if (this.settings() && !this.warehouse()) {
      out.push('لا يوجد مخزن نشط لنقطة البيع — عرّف مخزنًا أو حدده في إعدادات نقطة البيع');
    }
    if (!this.methods().includes(this.method())) out.push('طريقة الدفع المختارة لم تعد مفعّلة في إعدادات نقطة البيع');
    for (const l of this.cart()) {
      if (l.qty > l.available) out.push(`«${l.name}»: المتاح ${Math.max(l.available, 0)} ${l.unit} فقط`);
      if (l.discountPct > this.maxDiscount()) out.push(`خصم «${l.name}» يتجاوز الحد المسموح ${this.maxDiscount()}%`);
    }
    const subtotal = this.totals().subtotal;
    if (subtotal > 0 && this.discount() > (subtotal * this.maxDiscount()) / 100) {
      out.push(`خصم الفاتورة يتجاوز ${this.maxDiscount()}% من الإجمالي`);
    }
    if (this.method() === 'credit' && !this.customer()) out.push('البيع الآجل يتطلب اختيار عميل مسجل');
    if (this.method() === 'cash' && this.shortfall() > 0) out.push('المبلغ المدفوع أقل من الصافي');
    return out;
  });

  protected readonly canCheckout = computed(() => !!this.cart().length && !this.problems().length && !this.checkingOut());

  // ── Quick customer & receipt & held carts ──

  protected readonly quickOpen = signal(false);
  protected readonly quickName = signal('');
  protected readonly quickPhone = signal('');
  protected readonly quickSaving = signal(false);
  /** Same rule and wording as every other mobile field (AppValidators.mobile). */
  protected readonly quickPhoneError = computed(() => validationMessage(AppValidators.mobile(), this.quickPhone()));
  protected readonly quickPhoneValid = computed(() => !!this.quickPhone().trim() && !this.quickPhoneError());

  protected readonly receipt = signal<ReceiptData | null>(null);
  protected readonly heldOpen = signal(false);

  protected readonly money = formatMoney;
  protected readonly relative = formatRelative;
  protected readonly methodLabel = DOC_PAYMENT_LABEL;
  protected readonly lineTotal = lineTotal;
  protected readonly itemsLabel = (n: number) => pluralAr(n, ITEMS_PLURAL);

  constructor() {
    // The cashier starts typing / scanning right away.
    afterNextRender(() => this.focusSearch());
  }

  // ── Shortcuts ──

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (this.receipt() || this.quickOpen() || this.heldOpen()) return;
    if (e.key === 'F2') {
      e.preventDefault();
      this.focusSearch();
    } else if (e.key === 'F9') {
      e.preventDefault();
      this.checkout();
    }
  }

  // ── Catalogue actions ──

  protected onSearchKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.term.set('');
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const raw = this.term().trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    const exact = (this.items.value() ?? []).find(
      (i) => i.barcode?.toLowerCase() === lower || normalizeArabic(i.code) === normalizeArabic(raw),
    );
    const target = exact ?? (this.visibleItems().length === 1 ? this.visibleItems()[0] : null);
    if (target) {
      if (this.add(target)) this.term.set('');
    } else {
      this.toast.info('لا يوجد صنف بهذا الباركود أو الكود');
    }
  }

  /** Returns false when nothing could be added (out of stock). */
  protected add(item: ItemLookup): boolean {
    if (item.available <= 0) {
      this.toast.warning(`«${item.name}» غير متاح في ${this.warehouse()?.name ?? 'المخزن'}`);
      return false;
    }
    const existing = this.cart().find((l) => l.itemId === item.id);
    if (existing && existing.qty >= item.available) {
      this.toast.warning(`المتاح من «${item.name}» ${item.available} ${item.unit} فقط`);
      return false;
    }
    this.cart.update((lines) =>
      existing
        ? lines.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1, available: item.available } : l))
        : [...lines, toCartLine(item)],
    );
    return true;
  }

  protected inCart(itemId: string): number {
    return this.cart().find((l) => l.itemId === itemId)?.qty ?? 0;
  }

  // ── Cart actions ──

  protected setQty(line: CartLine, qty: number): void {
    const q = Math.floor(Number(qty) || 0);
    if (q <= 0) return this.removeLine(line);
    this.cart.update((lines) => lines.map((l) => (l.itemId === line.itemId ? { ...l, qty: q } : l)));
  }

  protected setLineDiscount(line: CartLine, pct: number): void {
    const d = Math.min(Math.max(Number(pct) || 0, 0), 100);
    this.cart.update((lines) => lines.map((l) => (l.itemId === line.itemId ? { ...l, discountPct: d } : l)));
  }

  protected removeLine(line: CartLine): void {
    this.cart.update((lines) => lines.filter((l) => l.itemId !== line.itemId));
  }

  protected setDiscount(value: number): void {
    this.discount.set(Math.max(0, Number(value) || 0));
  }

  protected setTendered(value: string): void {
    const n = Number(value);
    this.tendered.set(value === '' || !Number.isFinite(n) ? null : Math.max(0, n));
  }

  protected selectMethod(m: PosPaymentMethod): void {
    this.method.set(m);
    this.tendered.set(null);
  }

  /** Round tender up to a convenient note. */
  protected quickTender(): number[] {
    const total = this.totals().total;
    if (!total) return [];
    const options = new Set<number>([Math.ceil(total)]);
    for (const note of [50, 100, 200, 500, 1000]) {
      const v = Math.ceil(total / note) * note;
      if (v > total) options.add(v);
    }
    return [...options].sort((a, b) => a - b).slice(0, 4);
  }

  protected clearCart(): void {
    this.cart.set([]);
    this.discount.set(0);
    this.tendered.set(null);
    this.taxPct.set(null);
    this.customerId.set(WALK_IN);
    this.method.set(this.methods()[0] ?? 'cash');
  }

  // ── Held carts ──

  protected holdCart(): void {
    if (!this.cart().length) return;
    this.held.hold({ customer: this.customer(), lines: this.cart(), discount: this.discount(), note: '' });
    this.clearCart();
    this.toast.info('تم تعليق الفاتورة — يمكنك استئنافها من «المعلّقة»');
  }

  protected resume(id: string): void {
    if (this.cart().length) this.holdCart();
    const cart = this.held.take(id);
    if (!cart) return;
    this.cart.set(cart.lines);
    this.discount.set(cart.discount);
    this.customerId.set(cart.customer && this.customers().some((c) => c.id === cart.customer!.id) ? cart.customer.id : WALK_IN);
    this.heldOpen.set(false);
    this.refreshAvailability();
  }

  protected heldTotal(lines: CartLine[], discount: number): number {
    return docTotals(lines, discount, this.effectiveTax(), 0).total;
  }

  // ── Quick customer ──

  protected openQuick(): void {
    this.quickName.set('');
    this.quickPhone.set('');
    this.quickOpen.set(true);
  }

  protected saveQuick(): void {
    const name = this.quickName().trim();
    const phone = this.quickPhone().trim();
    if (name.length < 2 || !this.quickPhoneValid()) return;
    this.quickSaving.set(true);
    this.parties
      .create({
        kind: 'customer',
        name,
        phone,
        phone2: '',
        email: '',
        city: '',
        address: '',
        taxNumber: '',
        commercialRegister: '',
        creditLimit: 0,
        paymentTermDays: 0,
        priceList: 'retail',
        openingBalance: 0,
        notes: 'مسجّل من نقطة البيع',
        isActive: true,
        isExternal: true,
      })
      .pipe(finalize(() => this.quickSaving.set(false)))
      .subscribe((p) => {
        this.refreshCustomers$.next();
        this.customerId.set(p.id);
        this.quickOpen.set(false);
        this.toast.success(`تم تسجيل العميل ${p.name}`);
      });
  }

  // ── Checkout ──

  protected checkout(): void {
    if (!this.cart().length) {
      this.toast.info('السلة فارغة');
      return;
    }
    const issues = this.problems();
    if (issues.length) {
      this.toast.warning(issues[0]);
      return;
    }
    const wh = this.warehouse();
    if (!wh || this.checkingOut()) return;

    const totals = this.totals();
    const method = this.method();
    const tendered = this.tendered();
    const paid = method === 'credit' ? Math.min(tendered ?? 0, totals.total) : totals.total;
    const lines = this.cart();
    const customer = this.customer();

    this.checkingOut.set(true);
    this.docs
      .create({
        kind: 'sale',
        channel: 'pos',
        post: true,
        date: todayIsoDate(),
        dueDate: null,
        partyId: customer?.id ?? null,
        warehouseId: wh.id,
        toWarehouseId: null,
        reference: '',
        reason: null,
        paymentMethod: method,
        lines: lines.map(({ itemId, qty, price, discountPct }) => ({ itemId, qty, price, discountPct })),
        discount: totals.discount,
        taxPct: this.effectiveTax(),
        paid,
        notes: '',
      })
      .pipe(finalize(() => this.checkingOut.set(false)))
      .subscribe({
        // The interceptor already toasted the server's reason (discount over
        // the cap, payment method disabled, credit limit, stock…). Refresh what
        // the server judged against so the terminal reflects it; the cart is kept.
        error: (err: ApiError) => {
          if (err.status === 409 || err.status === 422) {
            this.reloadSettings$.next();
            this.items.reload();
          }
        },
        next: (doc) => {
          const s = this.settings();
          this.receipt.set({
            header: s?.receiptHeader ?? '',
            footer: s?.receiptFooter ?? '',
            number: doc.number,
            at: doc.createdAt,
            cashier: this.auth.currentUser()?.name ?? doc.createdBy,
            customer: doc.partyName,
            warehouse: doc.warehouseName,
            lines: doc.lines.map(({ name, qty, price, discountPct, total }) => ({ name, qty, price, discountPct, total })),
            subtotal: doc.subtotal,
            discount: doc.discount,
            taxPct: doc.taxPct,
            tax: doc.tax,
            total: doc.total,
            paid: doc.paid,
            change: method === 'cash' ? this.change() : 0,
            remaining: doc.remaining,
            methodLabel: DOC_PAYMENT_LABEL[method],
            paperWidth: s?.paperWidth ?? 80,
          });
          this.clearCart();
          this.items.reload();
          if (customer) this.refreshCustomers$.next();
          if (s?.autoPrint) afterNextRender(() => this.receiptView()?.print(), { injector: this.injector });
        },
      });
  }

  protected printReceipt(): void {
    this.receiptView()?.print();
  }

  protected closeReceipt(): void {
    this.receipt.set(null);
    this.focusSearch();
  }

  // ── helpers ──

  private focusSearch(): void {
    const el = this.searchInput().nativeElement;
    el.focus();
    el.select();
  }

  /** Re-reads availability for held lines after resuming. */
  private refreshAvailability(): void {
    const byId = new Map((this.items.value() ?? []).map((i) => [i.id, i]));
    this.cart.update((lines) =>
      lines.map((l) => {
        const item = byId.get(l.itemId);
        return item ? { ...l, available: item.available } : { ...l, available: 0 };
      }),
    );
  }
}
