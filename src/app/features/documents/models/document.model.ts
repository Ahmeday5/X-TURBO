import { StatusView } from '../../../shared/models/status-tone.model';
import { IconName } from '../../../shared/components/icon/icon.component';

/**
 * Wire contract of the documents API — every stock / trade document shares
 * one shape (header + item lines + totals) and differs only by `kind`.
 * What each kind needs (party, warehouses, prices, payment, stock effect)
 * is described once in DOC_KIND_CONFIG and drives both UI and validation.
 */

export type DocKind =
  | 'quotation'
  | 'sale'
  | 'purchase'
  | 'sale-return'
  | 'purchase-return'
  | 'transfer'
  | 'reservation';

/**
 * draft     → editable, no effect.
 * posted    → effects applied (stock / balances). For a voucher transfer: issued, in transit.
 *             For a reservation: items held. For a quotation: approved / sent.
 * completed → follow-up done: voucher transfer received, reservation delivered,
 *             quotation converted to a sale.
 * cancelled → effects reversed.
 */
export type DocStatus = 'draft' | 'posted' | 'completed' | 'cancelled';

export type DocPaymentMethod = 'cash' | 'card' | 'wallet' | 'bank' | 'credit';

export interface DocLine {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  /** Unit price (sale or purchase price depending on kind; cost for stock moves). */
  price: number;
  /** 0–100, per line. */
  discountPct: number;
  /** qty × price × (1 − discountPct/100), rounded to 2dp. */
  total: number;
}

interface DocumentHeader {
  id: string;
  kind: DocKind;
  /** e.g. `SI-000123`. */
  number: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Reservation pickup / quotation validity / credit due date. */
  dueDate: string | null;
  partyId: string | null;
  partyName: string | null;
  warehouseId: string;
  warehouseName: string;
  /** Destination for transfers. */
  toWarehouseId: string | null;
  toWarehouseName: string | null;
  /** Supplier invoice no., PO, reason… free text. */
  reference: string;
  /** Part of the API contract; not used by any kind this dashboard manages (always null). */
  reason: string | null;
  paymentMethod: DocPaymentMethod | null;
  subtotal: number;
  /** Header discount (amount). */
  discount: number;
  /** VAT %. */
  taxPct: number;
  tax: number;
  total: number;
  paid: number;
  remaining: number;
  status: DocStatus;
  channel: 'erp' | 'pos';
  /** The document this one was created from (quotation → sale, reservation → sale, sale → return). */
  sourceId: string | null;
  sourceNumber: string | null;
  /** Documents created from this one. */
  targetId: string | null;
  targetNumber: string | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  postedAt: string | null;
}

/** List row. */
export interface DocumentSummary extends DocumentHeader {
  linesCount: number;
  totalQty: number;
}

/** Full document (`GET documents/:id`). */
export interface Document extends DocumentHeader {
  lines: DocLine[];
}

/** Business-rule codes the documents API answers with (409). */
export const DOCUMENT_ERROR_CODES = {
  /** Only drafts can be edited / deleted / posted. */
  notDraft: 'DOCUMENT_NOT_DRAFT',
  alreadyPosted: 'DOCUMENT_ALREADY_POSTED',
  /** Cancel refused while a return of this document is still active — cancel the return first. */
  hasReturns: 'DOCUMENT_HAS_RETURNS',
  /** Credit sale would push the customer past their credit limit. */
  creditLimitExceeded: 'CREDIT_LIMIT_EXCEEDED',
} as const;

export interface DocLinePayload {
  itemId: string;
  qty: number;
  price: number;
  discountPct: number;
}

export interface DocumentPayload {
  kind: DocKind;
  date: string;
  dueDate: string | null;
  partyId: string | null;
  warehouseId: string;
  toWarehouseId: string | null;
  reference: string;
  /** Always null — see `DocumentHeader.reason`. */
  reason: null;
  paymentMethod: DocPaymentMethod | null;
  lines: DocLinePayload[];
  discount: number;
  taxPct: number;
  paid: number;
  notes: string;
  channel?: 'erp' | 'pos';
  /** Post immediately after saving (otherwise saved as draft). */
  post: boolean;
}

/** `GET documents/stats?kind=` — totals for the same filters as the list. */
export interface DocumentStats {
  count: number;
  draft: number;
  posted: number;
  completed: number;
  cancelled: number;
  /** Sum of totals of non-cancelled documents. */
  total: number;
  paid: number;
  remaining: number;
  totalQty: number;
}

// ── Per-kind behaviour ──

export type PartyRole = 'customer' | 'supplier';
/** Which item price pre-fills a new line. `cost` = purchase price used as valuation. */
export type PriceSource = 'sale' | 'purchase' | 'cost';
/**
 * Stock effect when posted: `out` / `in` on the warehouse, `move` from
 * warehouse to destination at once,
 * `reserve` holds qty, `none` for quotations.
 */
export type StockEffect = 'out' | 'in' | 'move' | 'reserve' | 'none';

export interface DocKindConfig {
  kind: DocKind;
  /** Nav route of the kind's screen. */
  route: string;
  /** Plural / screen title. */
  title: string;
  /** "فاتورة بيع" — used in buttons and headings. */
  singular: string;
  /** Number prefix. */
  prefix: string;
  icon: IconName;
  party: PartyRole | null;
  /** Party is mandatory (credit is impossible without one). */
  partyRequired: boolean;
  /** Uses a destination warehouse. */
  transfer: boolean;
  priceSource: PriceSource;
  /** Shows discount, VAT and payment. */
  financial: boolean;
  stock: StockEffect;
  /** Label of `dueDate` (null → hidden). */
  dueDateLabel: string | null;
  /** Labels for statuses where the generic wording doesn't fit. */
  statusLabels?: Partial<Record<DocStatus, string>>;
  /** Follow-up action on a posted document (posted → completed). */
  completeAction?: { label: string; icon: IconName; hint: string };
  /** Kinds a posted document can be converted into. */
  convertTo?: readonly DocKind[];
}

const SALE_LIKE = { party: 'customer', priceSource: 'sale', financial: true } as const;
const PURCHASE_LIKE = { party: 'supplier', priceSource: 'purchase', financial: true } as const;
const STOCK_ONLY = {
  party: null,
  partyRequired: false,
  priceSource: 'cost',
  financial: false,
  dueDateLabel: null,
} as const;

export const DOC_KIND_CONFIG: Record<DocKind, DocKindConfig> = {
  quotation: {
    kind: 'quotation',
    route: '/invoices/quotations',
    title: 'عروض الأسعار',
    singular: 'عرض سعر',
    prefix: 'QT',
    icon: 'file-percent',
    ...SALE_LIKE,
    partyRequired: true,
    transfer: false,
    stock: 'none',
    dueDateLabel: 'صالح حتى',
    statusLabels: { posted: 'معتمد', completed: 'تحوّل لفاتورة' },
    convertTo: ['sale'],
  },
  sale: {
    kind: 'sale',
    route: '/invoices/sales',
    title: 'فواتير المبيعات',
    singular: 'فاتورة بيع',
    prefix: 'SI',
    icon: 'tag',
    ...SALE_LIKE,
    partyRequired: false,
    transfer: false,
    stock: 'out',
    dueDateLabel: 'تاريخ الاستحقاق',
    convertTo: ['sale-return'],
  },
  purchase: {
    kind: 'purchase',
    route: '/invoices/purchases',
    title: 'فواتير المشتريات',
    singular: 'فاتورة شراء',
    prefix: 'PI',
    icon: 'cart',
    ...PURCHASE_LIKE,
    partyRequired: true,
    transfer: false,
    stock: 'in',
    dueDateLabel: 'تاريخ الاستحقاق',
    convertTo: ['purchase-return'],
  },
  'sale-return': {
    kind: 'sale-return',
    route: '/invoices/sales-returns',
    title: 'مرتجع المبيعات',
    singular: 'مرتجع بيع',
    prefix: 'SR',
    icon: 'return',
    ...SALE_LIKE,
    partyRequired: false,
    transfer: false,
    stock: 'in',
    dueDateLabel: null,
  },
  'purchase-return': {
    kind: 'purchase-return',
    route: '/invoices/purchase-returns',
    title: 'مرتجع المشتريات',
    singular: 'مرتجع شراء',
    prefix: 'PR',
    icon: 'return',
    ...PURCHASE_LIKE,
    partyRequired: true,
    transfer: false,
    stock: 'out',
    dueDateLabel: null,
  },
  transfer: {
    kind: 'transfer',
    route: '/invoices/transfers',
    title: 'تحويلات المخازن',
    singular: 'تحويل مخزني',
    prefix: 'TR',
    icon: 'swap',
    ...STOCK_ONLY,
    transfer: true,
    stock: 'move',
    statusLabels: { posted: 'تم التحويل' },
  },
  reservation: {
    kind: 'reservation',
    route: '/pos/reservations',
    title: 'حجز الطلبيات',
    singular: 'حجز طلبية',
    prefix: 'RS',
    icon: 'calendar',
    ...SALE_LIKE,
    partyRequired: true,
    transfer: false,
    stock: 'reserve',
    dueDateLabel: 'موعد الاستلام',
    statusLabels: { posted: 'محجوز', completed: 'تم التسليم' },
    completeAction: { label: 'تسليم وإصدار فاتورة', icon: 'check', hint: 'تُصدر فاتورة بيع بالأصناف ويُخصم العربون' },
  },
};

export const DOC_KINDS = Object.keys(DOC_KIND_CONFIG) as DocKind[];

/** Kind served by a nav route (each kind has exactly one screen). */
export function docKindForRoute(route: string): DocKind | null {
  return DOC_KINDS.find((k) => DOC_KIND_CONFIG[k].route === route) ?? null;
}

// ── Display maps ──

export const DOC_STATUSES: readonly DocStatus[] = ['draft', 'posted', 'completed', 'cancelled'];

const DOC_STATUS_BASE: Record<DocStatus, StatusView> = {
  draft: { label: 'مسودة', tone: 'neutral', color: 'var(--txt3)' },
  posted: { label: 'مُرحّل', tone: 'good', color: 'var(--gr)' },
  completed: { label: 'مكتمل', tone: 'info', color: 'var(--bl)' },
  cancelled: { label: 'ملغي', tone: 'danger', color: 'var(--re)' },
};

/** Status chip for a document of `kind` (kind-specific wording where configured). */
export function docStatusView(kind: DocKind, status: DocStatus): StatusView {
  const label = DOC_KIND_CONFIG[kind].statusLabels?.[status];
  return label ? { ...DOC_STATUS_BASE[status], label } : DOC_STATUS_BASE[status];
}

/** Statuses a kind can actually reach (filters / tabs). */
export function docStatusesFor(kind: DocKind): DocStatus[] {
  const cfg = DOC_KIND_CONFIG[kind];
  const hasCompleted = !!cfg.completeAction || !!cfg.statusLabels?.completed;
  return DOC_STATUSES.filter((s) => s !== 'completed' || hasCompleted);
}

export const DOC_PAYMENT_METHODS: readonly DocPaymentMethod[] = ['cash', 'card', 'wallet', 'bank', 'credit'];
export const DOC_PAYMENT_LABEL: Record<DocPaymentMethod, string> = {
  cash: 'نقدي',
  card: 'بطاقة',
  wallet: 'محفظة إلكترونية',
  bank: 'تحويل بنكي',
  credit: 'آجل',
};

// ── Maths (shared by the editor preview and the mock server) ──

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function lineTotal(qty: number, price: number, discountPct: number): number {
  return round2(qty * price * (1 - Math.min(Math.max(discountPct, 0), 100) / 100));
}

export interface DocTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  remaining: number;
}

/** VAT applies after the header discount. */
export function docTotals(
  lines: ReadonlyArray<Pick<DocLinePayload, 'qty' | 'price' | 'discountPct'>>,
  discount: number,
  taxPct: number,
  paid: number,
): DocTotals {
  const subtotal = round2(lines.reduce((s, l) => s + lineTotal(l.qty, l.price, l.discountPct), 0));
  const disc = round2(Math.min(Math.max(discount, 0), subtotal));
  const tax = round2(((subtotal - disc) * Math.max(taxPct, 0)) / 100);
  const total = round2(subtotal - disc + tax);
  return { subtotal, discount: disc, tax, total, remaining: round2(Math.max(total - Math.max(paid, 0), 0)) };
}
