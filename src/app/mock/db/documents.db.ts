import {
  DocKind,
  DocLine,
  DOC_KIND_CONFIG,
  DOC_KINDS,
  DocPaymentMethod,
  Document,
  DocumentPayload,
  DocumentSummary,
  docTotals,
  lineTotal,
} from '../../features/documents/models/document.model';
import { partyFits } from '../../features/parties/models/party.model';
import { StockMovement } from '../../features/warehouses/models/stock.model';
import { itemsSnapshot } from '../handlers/items.handlers';
import { fail } from '../mock-http';
import { pick, seeded } from '../mock-utils';
import { docNumber, findOr404, isoDaysAgo, round2, todayIso } from './db-utils';
import { partyBalance } from './ledger.db';
import { partyRows } from './parties.db';
import { adjustReserved, adjustStock, availableQty, cellOf, warehouseRows } from './warehouses.db';

/**
 * Trade & stock documents. Effects (stock, reservations) are applied when a
 * document is posted / completed and reversed when it is cancelled; party
 * and GL balances are derived from posted documents by ledger.db.ts.
 */

interface DocumentsDb {
  docs: Document[];
  seq: Record<DocKind, number>;
}

let state: DocumentsDb | null = null;

function db(): DocumentsDb {
  return (state ??= seed());
}

export function documentRows(): readonly Document[] {
  return db().docs;
}

export function toSummary({ lines, ...doc }: Document): DocumentSummary {
  return { ...doc, linesCount: lines.length, totalQty: lines.reduce((s, l) => s + l.qty, 0) };
}

/** A document counts in balances / movements once posted (or completed). */
export function isEffective(doc: Pick<Document, 'status'>): boolean {
  return doc.status === 'posted' || doc.status === 'completed';
}

// ── Seed ──

const SEED_DAYS = 150;

function seed(): DocumentsDb {
  const rand = seeded(9090);
  const items = itemsSnapshot().filter((i) => i.isActive);
  const warehouses = warehouseRows();
  const customers = partyRows().filter((p) => p.isActive && partyFits(p.kind, 'customer') && !p.isExternal);
  const wholesale = customers.filter((p) => p.priceList === 'wholesale');
  const suppliers = partyRows().filter((p) => p.isActive && partyFits(p.kind, 'supplier'));
  const staff = ['أحمد حسن', 'منى عادل', 'خالد عادل', 'ياسمين فتحي'];

  const docs: Document[] = [];
  const seq = Object.fromEntries(DOC_KINDS.map((k) => [k, 0])) as Record<DocKind, number>;

  const lines = (count: number, qty: () => number, price: 'sale' | 'purchase'): DocLine[] => {
    const picked = new Set<number>();
    while (picked.size < count) picked.add(Math.floor(rand() * items.length));
    return [...picked].map((i) => {
      const item = items[i];
      const q = qty();
      const p = price === 'sale' ? item.salePrice : item.purchasePrice;
      const discountPct = rand() < 0.15 ? pick(rand, [5, 10]) : 0;
      return { itemId: item.id, code: item.code, name: item.name, unit: item.unit, qty: q, price: p, discountPct, total: lineTotal(q, p, discountPct) };
    });
  };

  const push = (kind: DocKind, day: number, fields: Partial<Document> & Pick<Document, 'lines' | 'warehouseId'>) => {
    const n = ++seq[kind];
    const wh = warehouses.find((w) => w.id === fields.warehouseId)!;
    const to = fields.toWarehouseId ? warehouses.find((w) => w.id === fields.toWarehouseId)! : null;
    const party = fields.partyId ? partyRows().find((p) => p.id === fields.partyId)! : null;
    const taxPct = fields.taxPct ?? 0;
    const discount = fields.discount ?? 0;
    const totals = docTotals(fields.lines, discount, taxPct, 0);
    const paid = Math.min(fields.paid ?? 0, totals.total);
    const date = isoDaysAgo(day);
    const createdAt = new Date(`${date}T${String(9 + Math.floor(rand() * 10)).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00`).toISOString();
    const status = fields.status ?? 'posted';
    docs.push({
      id: `doc-${kind}-${n}`,
      kind,
      number: docNumber(DOC_KIND_CONFIG[kind].prefix, n),
      date,
      dueDate: fields.dueDate ?? null,
      partyId: party?.id ?? null,
      partyName: party?.name ?? null,
      warehouseId: wh.id,
      warehouseName: wh.name,
      toWarehouseId: to?.id ?? null,
      toWarehouseName: to?.name ?? null,
      reference: fields.reference ?? '',
      reason: fields.reason ?? null,
      paymentMethod: fields.paymentMethod ?? null,
      lines: fields.lines,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxPct,
      tax: totals.tax,
      total: totals.total,
      paid,
      remaining: round2(totals.total - paid),
      status,
      channel: fields.channel ?? 'erp',
      sourceId: null,
      sourceNumber: null,
      targetId: null,
      targetNumber: null,
      notes: fields.notes ?? '',
      createdBy: pick(rand, staff),
      createdAt,
      postedAt: status === 'draft' ? null : createdAt,
    });
  };

  const someWarehouse = () => (rand() < 0.55 ? warehouses[0] : pick(rand, warehouses)).id;
  const otherWarehouse = (id: string) => pick(rand, warehouses.filter((w) => w.id !== id)).id;
  const recentStatus = (day: number) => (day < 2 && rand() < 0.35 ? 'draft' : rand() < 0.03 ? 'cancelled' : 'posted');

  for (let day = SEED_DAYS; day >= 0; day--) {
    // Retail + POS sales.
    const sales = 1 + Math.floor(rand() * 2);
    for (let s = 0; s < sales; s++) {
      const pos = rand() < 0.45;
      const party = pos ? null : rand() < 0.6 ? pick(rand, customers) : null;
      const method: DocPaymentMethod = pick(rand, ['cash', 'cash', 'card', 'wallet']);
      const ls = lines(1 + Math.floor(rand() * 3), () => 1 + Math.floor(rand() * 3), 'sale');
      push('sale', day, {
        lines: ls,
        warehouseId: pos ? (rand() < 0.5 ? 'wh-shw' : warehouses[0].id) : someWarehouse(),
        partyId: party?.id,
        paymentMethod: method,
        paid: Number.MAX_SAFE_INTEGER,
        channel: pos ? 'pos' : 'erp',
        status: pos ? 'posted' : recentStatus(day),
      });
    }
    // Wholesale credit sales.
    if (rand() < 0.45 && wholesale.length) {
      const party = pick(rand, wholesale);
      const ls = lines(2 + Math.floor(rand() * 4), () => 2 + Math.floor(rand() * 8), 'sale');
      const total = docTotals(ls, 0, 14, 0).total;
      push('sale', day, {
        lines: ls,
        warehouseId: someWarehouse(),
        partyId: party.id,
        taxPct: 14,
        discount: rand() < 0.3 ? Math.round(total * 0.03) : 0,
        paymentMethod: 'credit',
        paid: rand() < 0.4 ? Math.round((total * pick(rand, [0.3, 0.5])) / 10) * 10 : 0,
        dueDate: isoDaysAgo(day - partyRows().find((p) => p.id === party.id)!.paymentTermDays),
        status: recentStatus(day),
      });
    }
    // Purchases.
    if (day % 3 === 0) {
      const ls = lines(2 + Math.floor(rand() * 4), () => 4 + Math.floor(rand() * 11), 'purchase');
      const total = docTotals(ls, 0, 14, 0).total;
      push('purchase', day, {
        lines: ls,
        warehouseId: warehouses[0].id,
        partyId: pick(rand, suppliers).id,
        taxPct: 14,
        paymentMethod: rand() < 0.3 ? 'bank' : 'credit',
        paid: rand() < 0.3 ? total : 0,
        reference: `INV-${10_000 + Math.floor(rand() * 89_999)}`,
        dueDate: isoDaysAgo(day - 30),
        status: recentStatus(day),
      });
    }
    // Quotations.
    if (rand() < 0.18) {
      const party = pick(rand, customers);
      push('quotation', day, {
        lines: lines(2 + Math.floor(rand() * 4), () => 1 + Math.floor(rand() * 6), 'sale'),
        warehouseId: warehouses[0].id,
        partyId: party.id,
        taxPct: party.priceList === 'wholesale' ? 14 : 0,
        dueDate: isoDaysAgo(day - 14),
        status: day < 14 ? (rand() < 0.4 ? 'draft' : 'posted') : rand() < 0.4 ? 'completed' : 'cancelled',
      });
    }
    // Returns.
    if (rand() < 0.08) {
      push('sale-return', day, {
        lines: lines(1, () => 1, 'sale'),
        warehouseId: someWarehouse(),
        partyId: rand() < 0.6 ? pick(rand, customers).id : undefined,
        paymentMethod: 'cash',
        paid: Number.MAX_SAFE_INTEGER,
        notes: pick(rand, ['القطعة غير مطابقة للموديل', 'عيب صناعة', 'العميل غيّر رأيه']),
      });
    }
    if (rand() < 0.04) {
      push('purchase-return', day, {
        lines: lines(1 + Math.floor(rand() * 2), () => 2 + Math.floor(rand() * 5), 'purchase'),
        warehouseId: warehouses[0].id,
        partyId: pick(rand, suppliers).id,
        taxPct: 14,
        paymentMethod: 'credit',
        notes: 'بضاعة تالفة عند الاستلام',
      });
    }
    // Stock movements.
    if (rand() < 0.1) {
      const from = warehouses[0].id;
      push('transfer', day, {
        lines: lines(2 + Math.floor(rand() * 4), () => 3 + Math.floor(rand() * 12), 'purchase'),
        warehouseId: from,
        toWarehouseId: otherWarehouse(from),
        status: recentStatus(day),
      });
    }
    // Reservations.
    if (rand() < 0.08) {
      const ls = lines(1 + Math.floor(rand() * 2), () => 1 + Math.floor(rand() * 2), 'sale');
      const total = docTotals(ls, 0, 0, 0).total;
      push('reservation', day, {
        lines: ls,
        warehouseId: pick(rand, [warehouses[0].id, 'wh-shw']),
        partyId: pick(rand, customers).id,
        paymentMethod: 'cash',
        paid: Math.round((total * 0.25) / 10) * 10,
        dueDate: isoDaysAgo(day - 3 - Math.floor(rand() * 7)),
        status: day > 10 ? (rand() < 0.8 ? 'completed' : 'cancelled') : 'posted',
      });
    }
  }

  // Open reservations hold stock.
  for (const doc of docs) {
    if (doc.kind === 'reservation' && doc.status === 'posted') {
      for (const l of doc.lines) adjustReserved(l.itemId, doc.warehouseId, l.qty);
    }
  }

  docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { docs, seq };
}

// ── Writes ──

/** Validates a payload and builds the document fields it controls. */
function build(payload: DocumentPayload, url: string, existing?: Document): Omit<Document, 'id' | 'number' | 'status' | 'createdBy' | 'createdAt' | 'postedAt' | 'sourceId' | 'sourceNumber' | 'targetId' | 'targetNumber'> {
  const kind = payload.kind;
  const cfg = DOC_KIND_CONFIG[kind];
  if (!cfg) throw fail(422, 'نوع المستند غير معروف', url);

  const wh = findOr404(warehouseRows(), payload.warehouseId, url, 'المخزن');
  if (!wh.isActive) throw fail(422, `المخزن «${wh.name}» موقوف`, url);

  let to = null;
  if (cfg.transfer) {
    to = findOr404(warehouseRows(), payload.toWarehouseId, url, 'المخزن المستلم');
    if (to.id === wh.id) throw fail(422, 'المخزن المستلم يجب أن يختلف عن المخزن المحوِّل', url);
  }

  let party = null;
  if (cfg.party && payload.partyId) {
    party = findOr404(partyRows(), payload.partyId, url, 'الحساب');
    if (!partyFits(party.kind, cfg.party)) throw fail(422, `«${party.name}» ليس ${cfg.party === 'customer' ? 'عميلًا' : 'موردًا'}`, url);
  }
  if (cfg.partyRequired && !party) throw fail(422, cfg.party === 'supplier' ? 'اختر المورد' : 'اختر العميل', url);

  const items = itemsSnapshot();
  if (!payload.lines?.length) throw fail(422, 'أضف صنفًا واحدًا على الأقل', url);
  const lines: DocLine[] = payload.lines.map((l, i) => {
    const item = items.find((it) => it.id === l.itemId);
    if (!item) throw fail(422, `الصنف في السطر ${i + 1} غير موجود`, url);
    const qty = Number(l.qty);
    if (!(qty > 0)) throw fail(422, `الكمية في السطر ${i + 1} يجب أن تكون أكبر من صفر`, url);
    const price = Math.max(0, Number(l.price) || 0);
    const discountPct = Math.min(100, Math.max(0, Number(l.discountPct) || 0));
    return { itemId: item.id, code: item.code, name: item.name, unit: item.unit, qty, price, discountPct, total: lineTotal(qty, price, discountPct) };
  });

  const taxPct = cfg.financial ? Math.max(0, Number(payload.taxPct) || 0) : 0;
  const discount = cfg.financial ? Math.max(0, Number(payload.discount) || 0) : 0;
  const totals = docTotals(lines, discount, taxPct, 0);
  // Quotations take no payment; reservations take a deposit.
  const paid = cfg.financial && cfg.stock !== 'none' ? Math.min(Math.max(0, Number(payload.paid) || 0), totals.total) : 0;
  const remaining = round2(totals.total - paid);
  const tracksPayment = cfg.financial && cfg.stock !== 'none' && kind !== 'reservation';
  if (tracksPayment && remaining > 0 && !party) throw fail(422, 'البيع / الشراء الآجل يتطلب تحديد الحساب', url);

  return {
    kind,
    date: payload.date || todayIso(),
    dueDate: cfg.dueDateLabel ? payload.dueDate || null : null,
    partyId: party?.id ?? null,
    partyName: party?.name ?? null,
    warehouseId: wh.id,
    warehouseName: wh.name,
    toWarehouseId: to?.id ?? null,
    toWarehouseName: to?.name ?? null,
    reference: (payload.reference ?? '').trim(),
    reason: null,
    paymentMethod: cfg.financial && cfg.stock !== 'none' ? (remaining > 0 && paid === 0 ? 'credit' : payload.paymentMethod ?? 'cash') : null,
    lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxPct,
    tax: totals.tax,
    total: totals.total,
    paid,
    remaining,
    channel: payload.channel ?? existing?.channel ?? 'erp',
    notes: (payload.notes ?? '').trim(),
  };
}

export function createDocument(payload: DocumentPayload, actor: string, url: string, source?: Document): Document {
  const fields = build(payload, url);
  const d = db();
  const n = ++d.seq[fields.kind];
  const doc: Document = {
    ...fields,
    id: `doc-${fields.kind}-${n}`,
    number: docNumber(DOC_KIND_CONFIG[fields.kind].prefix, n),
    status: 'draft',
    sourceId: source?.id ?? null,
    sourceNumber: source?.number ?? null,
    targetId: null,
    targetNumber: null,
    createdBy: actor,
    createdAt: new Date().toISOString(),
    postedAt: null,
  };
  if (source) assertReturnable(doc, source, url);
  d.docs.unshift(doc);
  if (payload.post) {
    try {
      postDocument(doc.id, url);
    } catch (err) {
      // Keep nothing half-done: a failed post leaves no draft behind.
      d.docs.splice(d.docs.indexOf(doc), 1);
      d.seq[fields.kind]--;
      throw err;
    }
  }
  return doc;
}

export function updateDocument(id: string, payload: DocumentPayload, url: string): Document {
  const doc = findOr404(db().docs, id, url, 'المستند');
  if (doc.status !== 'draft') throw fail(409, 'لا يمكن تعديل مستند مُرحّل — ألغِه وأنشئ غيره', url);
  if (payload.kind !== doc.kind) throw fail(422, 'لا يمكن تغيير نوع المستند', url);
  Object.assign(doc, build(payload, url, doc));
  const source = doc.sourceId ? db().docs.find((d) => d.id === doc.sourceId) : undefined;
  if (source) assertReturnable(doc, source, url);
  if (payload.post) postDocument(doc.id, url);
  return doc;
}

export function deleteDocument(id: string, url: string): void {
  const d = db();
  const doc = findOr404(d.docs, id, url, 'المستند');
  if (doc.status !== 'draft') throw fail(409, 'يمكن حذف المسودات فقط — ألغِ المستند بدلًا من ذلك', url);
  d.docs.splice(d.docs.indexOf(doc), 1);
}

export function postDocument(id: string, url: string): Document {
  const doc = findOr404(db().docs, id, url, 'المستند');
  if (doc.status !== 'draft') throw fail(409, 'المستند مُرحّل بالفعل', url);
  const cfg = DOC_KIND_CONFIG[doc.kind];

  if (cfg.stock === 'out' || cfg.stock === 'move' || cfg.stock === 'reserve') {
    assertAvailable(doc.warehouseId, doc.lines, url);
  }
  if (doc.kind === 'sale' && doc.partyId && doc.remaining > 0) assertCreditLimit(doc, url);

  applyPostEffects(doc, 1);
  doc.status = 'posted';
  doc.postedAt = new Date().toISOString();
  return doc;
}

export function completeDocument(id: string, actor: string, url: string): Document {
  const doc = findOr404(db().docs, id, url, 'المستند');
  const cfg = DOC_KIND_CONFIG[doc.kind];
  if (!cfg.completeAction) throw fail(422, 'هذا المستند لا يحتاج إلى إتمام', url);
  if (doc.status !== 'posted') throw fail(409, 'يجب ترحيل المستند أولًا', url);

  if (doc.kind === 'reservation') {
    for (const l of doc.lines) adjustReserved(l.itemId, doc.warehouseId, -l.qty);
    try {
      const sale = createDocument(
        {
          ...payloadOf(doc),
          kind: 'sale',
          date: todayIso(),
          dueDate: null,
          paid: doc.paid,
          paymentMethod: doc.paymentMethod ?? 'cash',
          notes: `تسليم ${doc.number}${doc.notes ? ` — ${doc.notes}` : ''}`,
          post: true,
        },
        actor,
        url,
      );
      sale.sourceId = doc.id;
      sale.sourceNumber = doc.number;
      doc.targetId = sale.id;
      doc.targetNumber = sale.number;
    } catch (err) {
      for (const l of doc.lines) adjustReserved(l.itemId, doc.warehouseId, l.qty);
      throw err;
    }
  }
  doc.status = 'completed';
  return doc;
}

export function cancelDocument(id: string, reason: string, url: string): Document {
  const doc = findOr404(db().docs, id, url, 'المستند');
  if (doc.status === 'cancelled') throw fail(409, 'المستند ملغي بالفعل', url);
  if (doc.status === 'completed') throw fail(409, 'لا يمكن إلغاء مستند مكتمل', url);
  const linked = db().docs.find((d) => d.sourceId === doc.id && d.status !== 'cancelled' && (d.kind === 'sale-return' || d.kind === 'purchase-return'));
  if (linked) throw fail(409, `ألغِ المرتجع المرتبط ${linked.number} أولًا`, url);
  if (doc.status === 'posted') {
    const cfg = DOC_KIND_CONFIG[doc.kind];
    // Reversing a receipt takes stock back out — it must still be there.
    if (cfg.stock === 'in') assertAvailable(doc.warehouseId, doc.lines, url, 'لا يمكن الإلغاء: الكمية المستلمة لم تعد متاحة');
    if (cfg.stock === 'move') assertAvailable(doc.toWarehouseId!, doc.lines, url, 'لا يمكن الإلغاء: الكمية المحوّلة لم تعد متاحة في المخزن المستلم');
    applyPostEffects(doc, -1);
  }
  doc.status = 'cancelled';
  if (reason?.trim()) doc.notes = doc.notes ? `${doc.notes}\nسبب الإلغاء: ${reason.trim()}` : `سبب الإلغاء: ${reason.trim()}`;
  return doc;
}

/** Draft of `to` pre-filled from `id`. */
export function convertDocument(id: string, to: DocKind, actor: string, url: string): Document {
  const source = findOr404(db().docs, id, url, 'المستند');
  const cfg = DOC_KIND_CONFIG[source.kind];
  if (!cfg.convertTo?.includes(to)) throw fail(422, 'لا يمكن التحويل إلى هذا النوع', url);
  if (source.status === 'cancelled' || source.status === 'draft') throw fail(409, 'رحّل المستند أولًا', url);
  if (source.kind === 'quotation' && source.status === 'completed') throw fail(409, `عرض السعر تحوّل بالفعل إلى ${source.targetNumber}`, url);
  if (source.kind === 'quotation' && source.dueDate && source.dueDate < todayIso()) {
    throw fail(409, 'انتهت صلاحية عرض السعر', url);
  }

  const isReturn = to === 'sale-return' || to === 'purchase-return';
  const lines = isReturn ? returnableLines(source) : source.lines;
  if (!lines.length) throw fail(409, 'تم إرجاع كل أصناف هذه الفاتورة', url);

  const draft = createDocument(
    {
      ...payloadOf({ ...source, lines }),
      kind: to,
      date: todayIso(),
      dueDate: null,
      paid: 0,
      discount: isReturn ? 0 : source.discount,
      reference: source.number,
      notes: '',
      post: false,
    },
    actor,
    url,
    isReturn ? source : undefined,
  );
  if (!isReturn) {
    draft.sourceId = source.id;
    draft.sourceNumber = source.number;
  }
  if (source.kind === 'quotation') {
    source.status = 'completed';
    source.targetId = draft.id;
    source.targetNumber = draft.number;
  }
  return draft;
}

// ── Effects & checks ──

function applyPostEffects(doc: Document, sign: 1 | -1): void {
  const cfg = DOC_KIND_CONFIG[doc.kind];
  for (const l of doc.lines) {
    const q = l.qty * sign;
    switch (cfg.stock) {
      case 'out':
        adjustStock(l.itemId, doc.warehouseId, -q);
        break;
      case 'in':
        adjustStock(l.itemId, doc.warehouseId, q);
        break;
      case 'move':
        adjustStock(l.itemId, doc.warehouseId, -q);
        adjustStock(l.itemId, doc.toWarehouseId!, q);
        break;
      case 'reserve':
        adjustReserved(l.itemId, doc.warehouseId, q);
        break;
    }
  }
}

function assertAvailable(warehouseId: string, lines: readonly DocLine[], url: string, message?: string): void {
  const wh = warehouseRows().find((w) => w.id === warehouseId);
  if (wh?.allowNegative) return;
  const need = new Map<string, number>();
  for (const l of lines) need.set(l.itemId, (need.get(l.itemId) ?? 0) + l.qty);
  for (const [itemId, qty] of need) {
    const available = availableQty(itemId, warehouseId);
    if (qty > available) {
      const line = lines.find((l) => l.itemId === itemId)!;
      throw fail(
        409,
        message ?? `الكمية غير متاحة: «${line.name}» — المتاح في ${wh?.name ?? 'المخزن'} ${Math.max(available, 0)} ${line.unit}`,
        url,
      );
    }
  }
}

function assertCreditLimit(doc: Document, url: string): void {
  const party = partyRows().find((p) => p.id === doc.partyId);
  if (!party?.creditLimit) return;
  const exposure = partyBalance(party.id) + doc.remaining;
  if (exposure > party.creditLimit) {
    throw fail(409, `تجاوز حد الائتمان لـ«${party.name}»: الحد ${party.creditLimit.toLocaleString('en')} والمديونية بعد الفاتورة ${Math.round(exposure).toLocaleString('en')}`, url);
  }
}

/** Lines of `source` still returnable (sold qty − posted / draft returns already made). */
function returnableLines(source: Document, excludeId?: string): DocLine[] {
  const returned = new Map<string, number>();
  for (const d of db().docs) {
    if (d.sourceId === source.id && d.id !== excludeId && d.status !== 'cancelled') {
      for (const l of d.lines) returned.set(l.itemId, (returned.get(l.itemId) ?? 0) + l.qty);
    }
  }
  return source.lines
    .map((l) => {
      const qty = l.qty - (returned.get(l.itemId) ?? 0);
      return { ...l, qty, total: lineTotal(qty, l.price, l.discountPct) };
    })
    .filter((l) => l.qty > 0);
}

function assertReturnable(doc: Document, source: Document, url: string): void {
  const allowed = new Map(returnableLines(source, doc.id).map((l) => [l.itemId, l.qty]));
  for (const l of doc.lines) {
    const max = allowed.get(l.itemId) ?? 0;
    if (l.qty > max) throw fail(422, `لا يمكن إرجاع ${l.qty} من «${l.name}» — المتاح للإرجاع ${max}`, url);
  }
}

function payloadOf(doc: Document): DocumentPayload {
  return {
    kind: doc.kind,
    date: doc.date,
    dueDate: doc.dueDate,
    partyId: doc.partyId,
    warehouseId: doc.warehouseId,
    toWarehouseId: doc.toWarehouseId,
    reference: doc.reference,
    reason: null,
    paymentMethod: doc.paymentMethod,
    lines: doc.lines.map(({ itemId, qty, price, discountPct }) => ({ itemId, qty, price, discountPct })),
    discount: doc.discount,
    taxPct: doc.taxPct,
    paid: doc.paid,
    notes: doc.notes,
    channel: doc.channel,
    post: false,
  };
}

// ── Reads for other modules ──

/** Signed stock movements of one item from effective documents, newest first. */
export function itemMovements(itemId: string, limit = 30): StockMovement[] {
  const out: StockMovement[] = [];
  for (const doc of db().docs) {
    if (!isEffective(doc)) continue;
    const cfg = DOC_KIND_CONFIG[doc.kind];
    if (cfg.stock === 'none' || cfg.stock === 'reserve') continue;
    const qty = doc.lines.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.qty, 0);
    if (!qty) continue;
    const base = { documentId: doc.id, documentNumber: doc.number, kind: doc.kind, kindLabel: cfg.singular, date: doc.date, partyName: doc.partyName };
    if (cfg.stock === 'in') out.push({ ...base, warehouseId: doc.warehouseId, warehouseName: doc.warehouseName, qty });
    else out.push({ ...base, warehouseId: doc.warehouseId, warehouseName: doc.warehouseName, qty: -qty });
    if (cfg.stock === 'move') {
      out.push({ ...base, warehouseId: doc.toWarehouseId!, warehouseName: doc.toWarehouseName!, qty });
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/** Last movement per warehouse for an item, falling back to the stock cell timestamp. */
export function lastMovementAt(itemId: string, warehouseId: string): string | null {
  return cellOf(itemId, warehouseId).lastMovementAt;
}
