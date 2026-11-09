import { SYSTEM_ACCOUNTS } from '../../features/accounts/models/account.model';
import {
  JournalLine,
  Voucher,
  VOUCHER_KIND_CONFIG,
  VoucherKind,
  VoucherMethod,
  VoucherPayload,
  VoucherSummary,
} from '../../features/vouchers/models/voucher.model';
import { fail } from '../mock-http';
import { pick, seeded } from '../mock-utils';
import { accountRows } from './accounts.db';
import { costCenterRows } from './cost-centers.db';
import { docNumber, findOr404, isoDaysAgo, round2, todayIso } from './db-utils';
import { documentRows } from './documents.db';
import { partyRows } from './parties.db';

/** Receipt, payment and journal vouchers. GL / party effects are derived in ledger.db.ts. */

interface VouchersDb {
  vouchers: Voucher[];
  seq: Record<VoucherKind, number>;
}

/** Leaf accounts money can move through (cash boxes and banks). */
export const CASH_ACCOUNT_IDS: readonly string[] = [SYSTEM_ACCOUNTS.cash, SYSTEM_ACCOUNTS.bank, 'acc-1105'];

let state: VouchersDb | null = null;

function db(): VouchersDb {
  return (state ??= seed());
}

export function voucherRows(): readonly Voucher[] {
  return db().vouchers;
}

export function toVoucherSummary({ lines, ...v }: Voucher): VoucherSummary {
  return { ...v, linesCount: lines.length };
}

// ── Seed ──

function seed(): VouchersDb {
  const rand = seeded(4242);
  const staff = ['أحمد حسن', 'خالد عادل'];
  const vouchers: Voucher[] = [];
  const seq: Record<VoucherKind, number> = { receipt: 0, payment: 0, journal: 0 };
  const today = todayIso();

  const accountName = (id: string) => accountRows().find((a) => a.id === id)?.name ?? '';
  const centerName = (id: string | null) => (id ? costCenterRows().find((c) => c.id === id)?.name ?? null : null);

  const push = (kind: VoucherKind, date: string, fields: Partial<Voucher>) => {
    if (date > today) return;
    const n = ++seq[kind];
    const createdAt = new Date(`${date}T${String(10 + Math.floor(rand() * 8)).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00`).toISOString();
    const lines = fields.lines ?? [];
    vouchers.push({
      id: `vch-${kind}-${n}`,
      kind,
      number: docNumber(VOUCHER_KIND_CONFIG[kind].prefix, n),
      date,
      status: 'posted',
      description: '',
      reference: '',
      counterpartyType: null,
      partyId: null,
      partyName: null,
      accountId: null,
      accountName: null,
      cashAccountId: null,
      cashAccountName: null,
      method: null,
      amount: 0,
      costCenterId: null,
      costCenterName: null,
      totalDebit: round2(lines.reduce((s, l) => s + l.debit, 0)),
      totalCredit: round2(lines.reduce((s, l) => s + l.credit, 0)),
      createdBy: pick(rand, staff),
      createdAt,
      postedAt: createdAt,
      ...fields,
      lines,
    });
  };

  const money = (cashAccountId: string, method: VoucherMethod) => ({
    cashAccountId,
    cashAccountName: accountName(cashAccountId),
    method,
  });

  const plusDays = (iso: string, days: number) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Collections against credit sales / settlements of credit purchases.
  for (const doc of [...documentRows()].reverse()) {
    if (doc.status !== 'posted' || !doc.partyId || doc.remaining <= 0) continue;
    const party = partyRows().find((p) => p.id === doc.partyId)!;
    if (doc.kind === 'sale' && rand() < 0.85) {
      const date = plusDays(doc.date, Math.max(5, party.paymentTermDays - 5 + Math.floor(rand() * 15)));
      const full = rand() < 0.7;
      const bank = rand() < 0.45;
      push('receipt', date, {
        counterpartyType: 'party',
        partyId: party.id,
        partyName: party.name,
        amount: full ? doc.remaining : Math.round((doc.remaining * 0.5) / 10) * 10,
        description: `${full ? 'سداد' : 'دفعة من'} ${doc.number}`,
        reference: bank ? `TRX-${100_000 + Math.floor(rand() * 899_999)}` : '',
        ...money(bank ? SYSTEM_ACCOUNTS.bank : SYSTEM_ACCOUNTS.cash, bank ? 'bank' : 'cash'),
      });
    }
    if (doc.kind === 'purchase' && rand() < 0.75) {
      const date = plusDays(doc.date, 25 + Math.floor(rand() * 25));
      const cheque = rand() < 0.3;
      push('payment', date, {
        counterpartyType: 'party',
        partyId: party.id,
        partyName: party.name,
        amount: doc.remaining,
        description: `سداد فاتورة ${doc.reference || doc.number}`,
        reference: cheque ? `CHQ-${10_000 + Math.floor(rand() * 89_999)}` : '',
        ...money(SYSTEM_ACCOUNTS.bank, cheque ? 'cheque' : 'bank'),
      });
    }
  }

  // Recurring expenses (monthly, last 5 months).
  const branches = ['cc-1', 'cc-2', 'cc-3', 'cc-4', 'cc-5', 'cc-6'];
  const rent: Record<string, number> = { 'cc-1': 0, 'cc-2': 42_000, 'cc-3': 26_000, 'cc-4': 22_000, 'cc-5': 18_000, 'cc-6': 35_000 };
  for (let m = 4; m >= 0; m--) {
    const first = new Date();
    first.setDate(1);
    first.setMonth(first.getMonth() - m);
    const day = (d: number) => `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    for (const cc of branches) {
      if (rent[cc]) {
        push('payment', day(3), {
          counterpartyType: 'account',
          accountId: 'acc-5202',
          accountName: accountName('acc-5202'),
          amount: rent[cc],
          description: `إيجار شهر — ${centerName(cc)}`,
          costCenterId: cc,
          costCenterName: centerName(cc),
          ...money(SYSTEM_ACCOUNTS.bank, 'bank'),
        });
      }
      push('payment', day(26), {
        counterpartyType: 'account',
        accountId: 'acc-5201',
        accountName: accountName('acc-5201'),
        amount: Math.round((18_000 + rand() * 26_000) / 100) * 100,
        description: `رواتب الشهر — ${centerName(cc)}`,
        costCenterId: cc,
        costCenterName: centerName(cc),
        ...money(SYSTEM_ACCOUNTS.bank, 'bank'),
      });
    }
    push('payment', day(12), {
      counterpartyType: 'account',
      accountId: 'acc-5205',
      accountName: accountName('acc-5205'),
      amount: Math.round((15_000 + rand() * 25_000) / 100) * 100,
      description: 'حملة إعلانات ممولة',
      costCenterId: 'cc-7',
      costCenterName: centerName('cc-7'),
      ...money(SYSTEM_ACCOUNTS.bank, 'card'),
    });
    for (const d of [7, 14, 21, 28]) {
      push('payment', day(d), {
        counterpartyType: 'account',
        accountId: 'acc-5204',
        accountName: accountName('acc-5204'),
        amount: Math.round((2_500 + rand() * 4_000) / 50) * 50,
        description: 'مصاريف شحن وتوصيل',
        costCenterId: 'cc-8',
        costCenterName: centerName('cc-8'),
        ...money(SYSTEM_ACCOUNTS.cash, 'cash'),
      });
    }

    // Journals: utilities accrual, bank charges, POS cash deposit.
    const utilities = Math.round((9_000 + rand() * 7_000) / 10) * 10;
    push('journal', day(28), {
      description: 'إثبات استحقاق فاتورة الكهرباء والمياه',
      lines: [
        { accountId: 'acc-5203', accountCode: '5203', accountName: accountName('acc-5203'), debit: utilities, credit: 0, costCenterId: 'cc-2', costCenterName: centerName('cc-2'), note: '' },
        { accountId: 'acc-2102', accountCode: '2102', accountName: accountName('acc-2102'), debit: 0, credit: utilities, costCenterId: null, costCenterName: null, note: '' },
      ],
    });
    const charges = Math.round(300 + rand() * 900);
    push('journal', day(27), {
      description: 'مصروفات وعمولات بنكية',
      lines: [
        { accountId: 'acc-5207', accountCode: '5207', accountName: accountName('acc-5207'), debit: charges, credit: 0, costCenterId: null, costCenterName: null, note: '' },
        { accountId: SYSTEM_ACCOUNTS.bank, accountCode: '1102', accountName: accountName(SYSTEM_ACCOUNTS.bank), debit: 0, credit: charges, costCenterId: null, costCenterName: null, note: '' },
      ],
    });
    const cashDeposit = Math.round((180_000 + rand() * 60_000) / 1000) * 1000;
    push('journal', day(20), {
      description: 'توريد نقدية الصندوق الرئيسي إلى البنك',
      lines: [
        { accountId: SYSTEM_ACCOUNTS.bank, accountCode: '1102', accountName: accountName(SYSTEM_ACCOUNTS.bank), debit: cashDeposit, credit: 0, costCenterId: null, costCenterName: null, note: '' },
        { accountId: SYSTEM_ACCOUNTS.cash, accountCode: '1101', accountName: accountName(SYSTEM_ACCOUNTS.cash), debit: 0, credit: cashDeposit, costCenterId: null, costCenterName: null, note: '' },
      ],
    });
    const deposit = Math.round((40_000 + rand() * 50_000) / 100) * 100;
    push('journal', day(15), {
      description: 'توريد نقدية نقطة البيع إلى البنك',
      lines: [
        { accountId: SYSTEM_ACCOUNTS.bank, accountCode: '1102', accountName: accountName(SYSTEM_ACCOUNTS.bank), debit: deposit, credit: 0, costCenterId: null, costCenterName: null, note: '' },
        { accountId: 'acc-1105', accountCode: '1105', accountName: accountName('acc-1105'), debit: 0, credit: deposit, costCenterId: null, costCenterName: null, note: '' },
      ],
    });
  }

  // A couple of drafts awaiting review.
  push('receipt', today, {
    status: 'draft',
    postedAt: null,
    counterpartyType: 'account',
    accountId: 'acc-4103',
    accountName: accountName('acc-4103'),
    amount: 1_500,
    description: 'بيع كراتين وخردة',
    ...money(SYSTEM_ACCOUNTS.cash, 'cash'),
  });

  vouchers.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return { vouchers, seq };
}

// ── Writes ──

function leafAccount(id: string | null | undefined, url: string, what: string) {
  const acc = findOr404(accountRows(), id, url, what);
  if (acc.isGroup) throw fail(422, `«${acc.name}» حساب تجميعي — اختر حسابًا فرعيًا`, url);
  if (!acc.isActive) throw fail(422, `الحساب «${acc.name}» موقوف`, url);
  return acc;
}

function centerOf(id: string | null | undefined, url: string) {
  return id ? findOr404(costCenterRows(), id, url, 'مركز التكلفة') : null;
}

function build(p: VoucherPayload, url: string): Partial<Voucher> {
  const base = {
    kind: p.kind,
    date: p.date || todayIso(),
    description: (p.description ?? '').trim(),
    reference: (p.reference ?? '').trim(),
  };

  if (p.kind === 'journal') {
    const lines: JournalLine[] = (p.lines ?? [])
      .filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map((l, i) => {
        const acc = leafAccount(l.accountId, url, 'الحساب');
        const debit = round2(Math.max(0, Number(l.debit) || 0));
        const credit = round2(Math.max(0, Number(l.credit) || 0));
        if (debit && credit) throw fail(422, `السطر ${i + 1}: أدخل مدينًا أو دائنًا وليس الاثنين`, url);
        const cc = centerOf(l.costCenterId, url);
        if (acc.costCenterRequired && !cc) throw fail(422, `الحساب «${acc.name}» يتطلب مركز تكلفة`, url);
        return { accountId: acc.id, accountCode: acc.code, accountName: acc.name, debit, credit, costCenterId: cc?.id ?? null, costCenterName: cc?.name ?? null, note: (l.note ?? '').trim() };
      });
    if (lines.length < 2) throw fail(422, 'القيد يحتاج إلى سطرين على الأقل', url);
    const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
    const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
    if (totalDebit !== totalCredit) throw fail(422, `القيد غير متزن: المدين ${totalDebit} والدائن ${totalCredit}`, url);
    if (!base.description) throw fail(422, 'اكتب بيان القيد', url);
    return {
      ...base,
      lines,
      totalDebit,
      totalCredit,
      amount: totalDebit,
      counterpartyType: null,
      partyId: null,
      partyName: null,
      accountId: null,
      accountName: null,
      cashAccountId: null,
      cashAccountName: null,
      method: null,
      costCenterId: null,
      costCenterName: null,
    };
  }

  const amount = round2(Number(p.amount) || 0);
  if (!(amount > 0)) throw fail(422, 'المبلغ يجب أن يكون أكبر من صفر', url);
  if (!p.cashAccountId || !CASH_ACCOUNT_IDS.includes(p.cashAccountId)) throw fail(422, 'اختر الخزينة أو البنك', url);
  const cash = leafAccount(p.cashAccountId, url, 'الخزينة');

  let party = null;
  let account = null;
  if (p.counterpartyType === 'party') {
    party = findOr404(partyRows(), p.partyId, url, 'الحساب');
  } else if (p.counterpartyType === 'account') {
    account = leafAccount(p.accountId, url, 'الحساب');
    if (CASH_ACCOUNT_IDS.includes(account.id) && account.id === cash.id) throw fail(422, 'لا يمكن أن يكون الحساب المقابل هو نفس الخزينة', url);
  } else {
    throw fail(422, p.kind === 'receipt' ? 'حدد الجهة المقبوض منها' : 'حدد الجهة المصروف إليها', url);
  }
  const cc = centerOf(p.costCenterId, url);
  if (account?.costCenterRequired && !cc) throw fail(422, `الحساب «${account.name}» يتطلب مركز تكلفة`, url);

  return {
    ...base,
    counterpartyType: p.counterpartyType,
    partyId: party?.id ?? null,
    partyName: party?.name ?? null,
    accountId: account?.id ?? null,
    accountName: account?.name ?? null,
    cashAccountId: cash.id,
    cashAccountName: cash.name,
    method: p.method ?? 'cash',
    amount,
    costCenterId: cc?.id ?? null,
    costCenterName: cc?.name ?? null,
    lines: [],
    totalDebit: amount,
    totalCredit: amount,
  };
}

export function createVoucher(p: VoucherPayload, actor: string, url: string): Voucher {
  if (!VOUCHER_KIND_CONFIG[p.kind]) throw fail(422, 'نوع السند غير معروف', url);
  const fields = build(p, url);
  const d = db();
  const n = ++d.seq[p.kind];
  const now = new Date().toISOString();
  const voucher = {
    ...fields,
    id: `vch-${p.kind}-${n}`,
    number: docNumber(VOUCHER_KIND_CONFIG[p.kind].prefix, n),
    status: p.post ? 'posted' : 'draft',
    createdBy: actor,
    createdAt: now,
    postedAt: p.post ? now : null,
  } as Voucher;
  d.vouchers.unshift(voucher);
  return voucher;
}

export function updateVoucher(id: string, p: VoucherPayload, url: string): Voucher {
  const v = findOr404(db().vouchers, id, url, 'السند');
  if (v.status !== 'draft') throw fail(409, 'لا يمكن تعديل سند مُرحّل', url);
  if (p.kind !== v.kind) throw fail(422, 'لا يمكن تغيير نوع السند', url);
  Object.assign(v, build(p, url));
  if (p.post) postVoucher(id, url);
  return v;
}

export function deleteVoucher(id: string, url: string): void {
  const d = db();
  const v = findOr404(d.vouchers, id, url, 'السند');
  if (v.status !== 'draft') throw fail(409, 'يمكن حذف المسودات فقط — ألغِ السند بدلًا من ذلك', url);
  d.vouchers.splice(d.vouchers.indexOf(v), 1);
}

export function postVoucher(id: string, url: string): Voucher {
  const v = findOr404(db().vouchers, id, url, 'السند');
  if (v.status !== 'draft') throw fail(409, 'السند مُرحّل بالفعل', url);
  v.status = 'posted';
  v.postedAt = new Date().toISOString();
  return v;
}

export function cancelVoucher(id: string, reason: string, url: string): Voucher {
  const v = findOr404(db().vouchers, id, url, 'السند');
  if (v.status === 'cancelled') throw fail(409, 'السند ملغي بالفعل', url);
  v.status = 'cancelled';
  if (reason?.trim()) v.description = `${v.description}${v.description ? ' — ' : ''}سبب الإلغاء: ${reason.trim()}`;
  return v;
}
