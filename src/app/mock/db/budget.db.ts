/**
 * Planned amounts per (year, cost center) → account → 12 months.
 * Actuals are never stored — they come from ledger postings when served.
 */

export interface BudgetPlan {
  /** accountId → 12 monthly amounts. */
  lines: Map<string, number[]>;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Typical monthly plan for the company-wide budget (EGP). */
const MONTHLY_PLAN: Readonly<Record<string, number>> = {
  'acc-4101': 1_300_000,
  'acc-4102': -12_000,
  'acc-4103': 22_000,
  'acc-5101': 960_000,
  'acc-5201': 180_000,
  'acc-5202': 143_000,
  'acc-5203': 10_000,
  'acc-5204': 16_000,
  'acc-5205': 25_000,
  'acc-5206': 6_000,
  'acc-5207': 600,
};

/** Auto-parts demand peaks before summer travel and in Q4. */
const SEASON = [0.92, 0.9, 0.98, 1.02, 1.06, 1.1, 1.08, 1.0, 0.95, 1.0, 1.04, 1.12];
const SEASONAL = new Set(['acc-4101', 'acc-4102', 'acc-5101', 'acc-5204']);

const plans = new Map<string, BudgetPlan>();

const key = (year: number, costCenterId: string | null) => `${year}:${costCenterId ?? 'all'}`;

function seedPlan(year: number): BudgetPlan {
  const lines = new Map<string, number[]>();
  // Next year's plan grows ~8%.
  const growth = year > new Date().getFullYear() ? 1.08 : 1;
  for (const [accountId, monthly] of Object.entries(MONTHLY_PLAN)) {
    lines.set(
      accountId,
      SEASON.map((s) => Math.round((monthly * growth * (SEASONAL.has(accountId) ? s : 1)) / 100) * 100),
    );
  }
  return { lines, updatedAt: null, updatedBy: null };
}

/** The stored plan; company-wide plans for the current / adjacent years are seeded on first read. */
export function budgetPlan(year: number, costCenterId: string | null): BudgetPlan {
  const k = key(year, costCenterId);
  let plan = plans.get(k);
  if (!plan) {
    const thisYear = new Date().getFullYear();
    plan = !costCenterId && Math.abs(year - thisYear) <= 1 ? seedPlan(year) : { lines: new Map(), updatedAt: null, updatedBy: null };
    plans.set(k, plan);
  }
  return plan;
}

export function saveBudgetPlan(year: number, costCenterId: string | null, lines: Map<string, number[]>, by: string): BudgetPlan {
  const plan: BudgetPlan = { lines, updatedAt: new Date().toISOString(), updatedBy: by };
  plans.set(key(year, costCenterId), plan);
  return plan;
}
