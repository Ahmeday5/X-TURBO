/** Cost center — tags expense / revenue postings for analysis and budgeting. */
export interface CostCenter {
  id: string;
  /** `CC-01`. */
  code: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  manager: string;
  /** Planned annual spend (EGP), 0 = none. */
  annualBudget: number;
  color: string;
  notes: string;
  isActive: boolean;
  createdAt: string;

  // ── Computed by the server ──
  /** Σ expense postings tagged with this center, current year. */
  actualSpend: number;
  /** Σ revenue postings tagged with this center, current year. */
  actualRevenue: number;
  postingsCount: number;
}

export type CostCenterPayload = Pick<CostCenter, 'name' | 'parentId' | 'manager' | 'annualBudget' | 'color' | 'notes' | 'isActive'>;

export interface CostCenterOption {
  id: string;
  code: string;
  name: string;
  color: string;
}
