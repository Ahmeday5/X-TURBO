import { formatMoney } from '../../../shared/utils/format.util';
import { Account, ACCOUNT_NATURE_LABEL, AccountNature } from '../models/account.model';

/**
 * A balance is stored on the account's normal side; a negative value means
 * it sits on the opposite side. Shown as an absolute amount + side label.
 */
export function balanceSideOf(account: Pick<Account, 'balance' | 'nature'>): AccountNature | null {
  if (!account.balance) return null;
  if (account.balance > 0) return account.nature;
  return account.nature === 'debit' ? 'credit' : 'debit';
}

export function balanceText(account: Pick<Account, 'balance' | 'nature'>): { amount: string; side: string } {
  const side = balanceSideOf(account);
  return { amount: formatMoney(Math.abs(account.balance)), side: side ? ACCOUNT_NATURE_LABEL[side] : 'صفر' };
}

/** Ancestors of `id`, root first (the account itself excluded). */
export function ancestorsOf<T extends { id: string; parentId: string | null }>(rows: readonly T[], id: string | null): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: T[] = [];
  let cur = id ? byId.get(id) : undefined;
  while (cur?.parentId) {
    cur = byId.get(cur.parentId);
    if (cur) out.unshift(cur);
  }
  return out;
}

/**
 * Client-side mirror of the server's code generator (for the form preview
 * only — the server assigns the real code).
 */
export function predictChildCode(rows: readonly Pick<Account, 'id' | 'code' | 'parentId' | 'level'>[], parentId: string | null): string {
  if (!parentId) {
    return String(rows.filter((a) => !a.parentId).reduce((m, a) => Math.max(m, Number(a.code) || 0), 0) + 1);
  }
  const parent = rows.find((a) => a.id === parentId);
  if (!parent) return '';
  const children = rows.filter((a) => a.parentId === parentId);
  const width = parent.level >= 2 || children.some((c) => c.code.length - parent.code.length === 2) ? 2 : 1;
  const max = children.reduce((m, c) => Math.max(m, Number(c.code.slice(parent.code.length)) || 0), 0);
  return parent.code + String(max + 1).padStart(width, '0');
}
