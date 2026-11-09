import { SYSTEM_ACCOUNTS } from '../../features/accounts/models/account.model';
import { DOC_KIND_CONFIG, DocPaymentMethod, Document } from '../../features/documents/models/document.model';
import { partyFits, StatementEntry, StatementLine } from '../../features/parties/models/party.model';
import { Voucher } from '../../features/vouchers/models/voucher.model';
import { itemsSnapshot } from '../handlers/items.handlers';
import { round2 } from './db-utils';
import { WAREHOUSE_COST_CENTER } from './cost-centers.db';
import { documentRows, isEffective } from './documents.db';
import { partyRows } from './parties.db';
import { voucherRows } from './vouchers.db';

/**
 * Everything financial is DERIVED here from posted documents and vouchers —
 * never stored — so party balances, statements, account balances and budget
 * actuals can't drift from the source records.
 */

// ── Party ledger ──

export interface PartyEntry extends Omit<StatementEntry, 'balance'> {
  partyId: string;
  /** Source lines, for the detailed statement. */
  lines: StatementLine[];
  /** Sort key (ISO timestamp). */
  at: string;
}

/** Signed ledger lines (debit − credit) of every party, oldest first. Opening balances excluded. */
export function partyEntries(partyId?: string): PartyEntry[] {
  const out: PartyEntry[] = [];

  for (const doc of documentRows()) {
    if (!doc.partyId || !isEffective(doc) || (partyId && doc.partyId !== partyId)) continue;
    const cfg = DOC_KIND_CONFIG[doc.kind];
    if (!cfg.financial || cfg.stock === 'none' || doc.kind === 'reservation') continue;

    const lines = doc.lines.map(({ code, name, unit, qty, price, total }) => ({ code, name, unit, qty, price, total }));
    const base = { partyId: doc.partyId, sourceId: doc.id, sourceType: 'document' as const, sourceKind: doc.kind, number: doc.number, date: doc.date, at: doc.createdAt };
    // Debit side = the party owes more (sale, purchase return).
    const owesUs = doc.kind === 'sale' || doc.kind === 'purchase-return';
    out.push({
      ...base,
      description: `${cfg.singular}${doc.reference ? ` — ${doc.reference}` : ''}`,
      debit: owesUs ? doc.total : 0,
      credit: owesUs ? 0 : doc.total,
      lines,
    });
    if (doc.paid > 0) {
      out.push({
        ...base,
        at: `${doc.createdAt}~`,
        description: `${owesUs ? 'تحصيل' : 'سداد'} مع ${cfg.singular}`,
        debit: owesUs ? 0 : doc.paid,
        credit: owesUs ? doc.paid : 0,
        lines: [],
      });
    }
  }

  for (const v of voucherRows()) {
    if (v.status !== 'posted' || v.counterpartyType !== 'party' || !v.partyId || (partyId && v.partyId !== partyId)) continue;
    const isReceipt = v.kind === 'receipt';
    out.push({
      partyId: v.partyId,
      sourceId: v.id,
      sourceType: 'voucher',
      sourceKind: v.kind,
      number: v.number,
      date: v.date,
      at: v.createdAt,
      description: `${isReceipt ? 'سند قبض' : 'سند صرف'}${v.description ? ` — ${v.description}` : ''}`,
      debit: isReceipt ? 0 : v.amount,
      credit: isReceipt ? v.amount : 0,
      lines: [],
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
}

/** debit − credit, including the opening balance. `asOf` (ISO date) is inclusive. */
export function partyBalance(partyId: string, asOf?: string): number {
  const opening = partyRows().find((p) => p.id === partyId)?.openingBalance ?? 0;
  return round2(
    partyEntries(partyId)
      .filter((e) => !asOf || e.date <= asOf)
      .reduce((b, e) => b + e.debit - e.credit, opening),
  );
}

/** Every party's balance in one pass (balances report, lists). */
export function allPartyBalances(asOf?: string): Map<string, { debit: number; credit: number; balance: number; last: string | null }> {
  const map = new Map<string, { debit: number; credit: number; balance: number; last: string | null }>();
  for (const p of partyRows()) {
    const opening = p.openingBalance;
    map.set(p.id, { debit: Math.max(opening, 0), credit: Math.max(-opening, 0), balance: opening, last: null });
  }
  for (const e of partyEntries()) {
    if (asOf && e.date > asOf) continue;
    const row = map.get(e.partyId);
    if (!row) continue;
    row.debit = round2(row.debit + e.debit);
    row.credit = round2(row.credit + e.credit);
    row.balance = round2(row.balance + e.debit - e.credit);
    row.last = e.date;
  }
  return map;
}

// ── General ledger ──

export interface GlPosting {
  accountId: string;
  date: string;
  debit: number;
  credit: number;
  costCenterId: string | null;
  sourceId: string;
  number: string;
  description: string;
}

/** Cash / bank account a payment method settles through. */
export function settlementAccount(method: DocPaymentMethod | null, channel: 'erp' | 'pos'): string {
  if (method === 'cash') return channel === 'pos' ? 'acc-1105' : SYSTEM_ACCOUNTS.cash;
  return SYSTEM_ACCOUNTS.bank;
}

function partyAccount(partyId: string, side: 'customer' | 'supplier'): string {
  const party = partyRows().find((p) => p.id === partyId);
  if (party && !partyFits(party.kind, side)) side = side === 'customer' ? 'supplier' : 'customer';
  return side === 'customer' ? SYSTEM_ACCOUNTS.customers : SYSTEM_ACCOUNTS.suppliers;
}

function costOf(doc: Document): number {
  const items = itemsSnapshot();
  return round2(doc.lines.reduce((s, l) => s + l.qty * (items.find((i) => i.id === l.itemId)?.purchasePrice ?? l.price), 0));
}

function docPostings(doc: Document): GlPosting[] {
  const out: GlPosting[] = [];
  const cc = WAREHOUSE_COST_CENTER[doc.warehouseId] ?? null;
  const add = (accountId: string, debit: number, credit: number) => {
    if (debit || credit) out.push({ accountId, date: doc.date, debit: round2(debit), credit: round2(credit), costCenterId: cc, sourceId: doc.id, number: doc.number, description: DOC_KIND_CONFIG[doc.kind].singular });
  };
  const net = doc.subtotal - doc.discount;
  const cash = settlementAccount(doc.paymentMethod, doc.channel);

  switch (doc.kind) {
    case 'sale': {
      const receivable = doc.partyId ? partyAccount(doc.partyId, 'customer') : SYSTEM_ACCOUNTS.customers;
      add(cash, doc.paid, 0);
      add(receivable, doc.remaining, 0);
      add(SYSTEM_ACCOUNTS.sales, 0, net);
      add(SYSTEM_ACCOUNTS.vat, 0, doc.tax);
      const cost = costOf(doc);
      add(SYSTEM_ACCOUNTS.cogs, cost, 0);
      add(SYSTEM_ACCOUNTS.inventory, 0, cost);
      break;
    }
    case 'sale-return': {
      const receivable = doc.partyId ? partyAccount(doc.partyId, 'customer') : SYSTEM_ACCOUNTS.customers;
      add(SYSTEM_ACCOUNTS.salesReturns, net, 0);
      add(SYSTEM_ACCOUNTS.vat, doc.tax, 0);
      add(cash, 0, doc.paid);
      add(receivable, 0, doc.remaining);
      const cost = costOf(doc);
      add(SYSTEM_ACCOUNTS.inventory, cost, 0);
      add(SYSTEM_ACCOUNTS.cogs, 0, cost);
      break;
    }
    case 'purchase': {
      const payable = partyAccount(doc.partyId!, 'supplier');
      add(SYSTEM_ACCOUNTS.inventory, net, 0);
      add(SYSTEM_ACCOUNTS.vat, doc.tax, 0);
      add(cash, 0, doc.paid);
      add(payable, 0, doc.remaining);
      break;
    }
    case 'purchase-return': {
      const payable = partyAccount(doc.partyId!, 'supplier');
      add(cash, doc.paid, 0);
      add(payable, doc.remaining, 0);
      add(SYSTEM_ACCOUNTS.inventory, 0, net);
      add(SYSTEM_ACCOUNTS.vat, 0, doc.tax);
      break;
    }
    case 'goods-issue': {
      const value = round2(doc.lines.reduce((s, l) => s + l.qty * l.price, 0));
      add(SYSTEM_ACCOUNTS.cogs, value, 0);
      add(SYSTEM_ACCOUNTS.inventory, 0, value);
      break;
    }
    case 'goods-receipt': {
      const value = round2(doc.lines.reduce((s, l) => s + l.qty * l.price, 0));
      add(SYSTEM_ACCOUNTS.inventory, value, 0);
      add(doc.reason === 'opening' ? 'acc-3102' : 'acc-4103', 0, value);
      break;
    }
  }
  return out;
}

function voucherPostings(v: Voucher): GlPosting[] {
  const base = { date: v.date, sourceId: v.id, number: v.number, description: v.description };
  if (v.kind === 'journal') {
    return v.lines.map((l) => ({ ...base, accountId: l.accountId, debit: l.debit, credit: l.credit, costCenterId: l.costCenterId, description: l.note || v.description }));
  }
  const counter =
    v.counterpartyType === 'party' && v.partyId
      ? partyAccount(v.partyId, v.kind === 'receipt' ? 'customer' : 'supplier')
      : v.accountId!;
  const cash = v.cashAccountId ?? SYSTEM_ACCOUNTS.cash;
  const cc = v.costCenterId;
  return v.kind === 'receipt'
    ? [
        { ...base, accountId: cash, debit: v.amount, credit: 0, costCenterId: null },
        { ...base, accountId: counter, debit: 0, credit: v.amount, costCenterId: cc },
      ]
    : [
        { ...base, accountId: counter, debit: v.amount, credit: 0, costCenterId: cc },
        { ...base, accountId: cash, debit: 0, credit: v.amount, costCenterId: null },
      ];
}

/** Date used for opening-balance postings (before any real movement). */
export const OPENING_DATE = '1900-01-01';

/**
 * Party opening balances live on the party; post them to the customers /
 * suppliers control accounts against retained earnings so the trial
 * balance always balances.
 */
function openingPostings(): GlPosting[] {
  const out: GlPosting[] = [];
  for (const p of partyRows()) {
    if (!p.openingBalance) continue;
    const control = p.openingBalance > 0 ? partyAccount(p.id, 'customer') : partyAccount(p.id, 'supplier');
    const amount = Math.abs(p.openingBalance);
    const base = { date: OPENING_DATE, costCenterId: null, sourceId: p.id, number: p.code, description: `رصيد افتتاحي — ${p.name}` };
    const debit = p.openingBalance > 0;
    out.push({ ...base, accountId: control, debit: debit ? amount : 0, credit: debit ? 0 : amount });
    out.push({ ...base, accountId: 'acc-3102', debit: debit ? 0 : amount, credit: debit ? amount : 0 });
  }
  return out;
}

/** Every posting from party openings, effective documents and posted vouchers. */
export function glPostings(): GlPosting[] {
  const out: GlPosting[] = openingPostings();
  for (const doc of documentRows()) if (isEffective(doc)) out.push(...docPostings(doc));
  for (const v of voucherRows()) if (v.status === 'posted') out.push(...voucherPostings(v));
  return out;
}

/** Σdebit / Σcredit per leaf account (optionally up to `asOf`). */
export function accountTotals(asOf?: string): Map<string, { debit: number; credit: number }> {
  const map = new Map<string, { debit: number; credit: number }>();
  for (const p of glPostings()) {
    if (asOf && p.date > asOf) continue;
    const row = map.get(p.accountId) ?? { debit: 0, credit: 0 };
    row.debit += p.debit;
    row.credit += p.credit;
    map.set(p.accountId, row);
  }
  return map;
}
