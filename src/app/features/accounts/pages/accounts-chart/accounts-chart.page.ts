import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { HighlightComponent } from '../../../../shared/components/highlight/highlight.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { StatusTab, StatusTabsComponent } from '../../../../shared/components/status-tabs/status-tabs.component';
import { SummaryTile, SummaryTilesComponent } from '../../../../shared/components/summary-tiles/summary-tiles.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { matchesAll, tokenize } from '../../../../shared/utils/arabic-search.util';
import { downloadCsv } from '../../../../shared/utils/csv.util';
import { formatMoney, formatMoneyCompact } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import {
  Account,
  ACCOUNT_ERROR_CODES,
  ACCOUNT_NATURE_LABEL,
  ACCOUNT_TYPE_VIEW,
  ACCOUNT_TYPES,
  AccountType,
  toAccountPayload,
} from '../../models/account.model';
import { ApiError } from '../../../../core/models/api-response.model';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { AccountsService } from '../../services/accounts.service';
import { balanceText } from '../../utils/account-display.util';

interface TreeRow {
  account: Account;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  /** Matches the search itself (not just an ancestor of a match). */
  hit: boolean;
}

const ACCOUNTS_PLURAL = { one: 'حساب واحد', two: 'حسابان', few: '# حسابات', other: '# حساب' };

/** Chart of accounts: collapsible tree with rolled-up balances, search, type tabs and a trial-balance check. */
@Component({
  selector: 'app-accounts-chart-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    HighlightComponent,
    PageHeaderComponent,
    StatusPillComponent,
    StatusTabsComponent,
    SummaryTilesComponent,
  ],
  templateUrl: './accounts-chart.page.html',
  styleUrl: './accounts-chart.page.scss',
})
export class AccountsChartPage {
  private readonly api = inject(AccountsService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  private readonly state = new UrlListState({ filters: ['type'] });
  protected readonly chart = createQueryResource(signal(0), () => this.api.list());
  protected readonly accounts = computed(() => this.chart.value() ?? []);

  protected readonly typeFilter = computed(() => (this.state.query().filters['type'] as AccountType | undefined) ?? null);
  protected readonly term = signal(this.state.query().search);
  private readonly tokens = computed(() => tokenize(this.term()));

  /** Group ids that are open. Default: the first two levels. */
  private readonly expandedIds = signal<ReadonlySet<string> | null>(null);
  private readonly expanded = computed<ReadonlySet<string>>(
    () => this.expandedIds() ?? new Set(this.accounts().filter((a) => a.isGroup && a.level <= 2).map((a) => a.id)),
  );

  protected readonly typeView = ACCOUNT_TYPE_VIEW;
  protected readonly natureLabel = ACCOUNT_NATURE_LABEL;
  protected readonly money = formatMoney;
  protected readonly balance = balanceText;

  private readonly childrenOf = computed(() => {
    const map = new Map<string | null, Account[]>();
    for (const a of this.accounts()) map.set(a.parentId, [...(map.get(a.parentId) ?? []), a]);
    return map;
  });

  /** Ids visible under the current search / type filter (`null` = everything). */
  private readonly visibleIds = computed<ReadonlySet<string> | null>(() => {
    const tokens = this.tokens();
    const type = this.typeFilter();
    if (!tokens.length && !type) return null;
    const all = this.accounts();
    const byId = new Map(all.map((a) => [a.id, a]));
    const ids = new Set<string>();
    for (const a of all) {
      if (type && a.type !== type) continue;
      if (tokens.length && !matchesAll([a.name, a.code], tokens)) continue;
      ids.add(a.id);
      for (let p = a.parentId ? byId.get(a.parentId) : undefined; p; p = p.parentId ? byId.get(p.parentId) : undefined) ids.add(p.id);
    }
    return ids;
  });

  protected readonly rows = computed<TreeRow[]>(() => {
    const children = this.childrenOf();
    const visible = this.visibleIds();
    const searching = this.tokens().length > 0;
    const expanded = this.expanded();
    const tokens = this.tokens();
    const out: TreeRow[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const a of children.get(parentId) ?? []) {
        if (visible && !visible.has(a.id)) continue;
        const kids = (children.get(a.id) ?? []).filter((c) => !visible || visible.has(c.id));
        // While searching every path to a hit is open.
        const open = searching || expanded.has(a.id);
        out.push({ account: a, depth, hasChildren: kids.length > 0, expanded: open && kids.length > 0, hit: searching && matchesAll([a.name, a.code], tokens) });
        if (open) walk(a.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  });

  protected readonly countLabel = computed(() => {
    const n = this.visibleIds()?.size ?? this.accounts().length;
    return pluralAr(n, ACCOUNTS_PLURAL);
  });

  private readonly roots = computed(() => this.accounts().filter((a) => !a.parentId));
  private rootBalance(type: AccountType): number {
    return this.roots()
      .filter((r) => r.type === type)
      .reduce((s, r) => s + r.balance, 0);
  }

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const ready = !!this.chart.value();
    const v = (type: AccountType) => (ready ? this.rootBalance(type) : null);
    const le = ready ? this.rootBalance('liability') + this.rootBalance('equity') : null;
    return [
      { label: 'الأصول', icon: 'briefcase', value: v('asset'), format: formatMoneyCompact, tone: ACCOUNT_TYPE_VIEW.asset.color },
      { label: 'الخصوم وحقوق الملكية', icon: 'scale', value: le, format: formatMoneyCompact, tone: ACCOUNT_TYPE_VIEW.liability.color },
      { label: 'الإيرادات', icon: 'trend-up', value: v('revenue'), format: formatMoneyCompact, tone: ACCOUNT_TYPE_VIEW.revenue.color },
      { label: 'المصروفات', icon: 'trend-down', value: v('expense'), format: formatMoneyCompact, tone: ACCOUNT_TYPE_VIEW.expense.color },
    ];
  });

  /** The server's trial balance — the authority on whether every posting balances. */
  private readonly trialBalance = createQueryResource(signal(0), () => this.api.trialBalance());

  /**
   * Debit vs credit totals. Taken from `accounts/trial-balance` when loaded;
   * until then (or if it fails) estimated from the chart's root balances
   * (Σ debit-nature roots vs Σ credit-nature roots).
   */
  protected readonly trial = computed(() => {
    const profit = this.rootBalance('revenue') - this.rootBalance('expense');
    const tb = this.trialBalance.value();
    if (tb) {
      const diff = Math.round((tb.totalDebit - tb.totalCredit) * 100) / 100;
      return { debit: tb.totalDebit, credit: tb.totalCredit, diff, balanced: tb.isBalanced, profit };
    }
    const roots = this.roots();
    const debit = roots.filter((r) => r.nature === 'debit').reduce((s, r) => s + r.balance, 0);
    const credit = roots.filter((r) => r.nature === 'credit').reduce((s, r) => s + r.balance, 0);
    const diff = Math.round((debit - credit) * 100) / 100;
    return { debit, credit, diff, balanced: Math.abs(diff) < 0.01, profit };
  });

  protected readonly tabs = computed<StatusTab[]>(() => {
    const all = this.accounts();
    return [
      { value: null, label: 'كل الحسابات', color: 'var(--primary)', count: all.length },
      ...ACCOUNT_TYPES.map((t) => ({
        value: t,
        label: ACCOUNT_TYPE_VIEW[t].label,
        color: ACCOUNT_TYPE_VIEW[t].color,
        count: all.filter((a) => a.type === t).length,
      })),
    ];
  });

  protected setType(type: string | null): void {
    this.state.setFilter('type', type);
  }

  protected onSearch(value: string): void {
    this.term.set(value);
    this.state.setSearch(value);
  }

  protected toggle(row: TreeRow): void {
    if (!row.hasChildren || this.tokens().length) return;
    const next = new Set(this.expanded());
    if (next.has(row.account.id)) next.delete(row.account.id);
    else next.add(row.account.id);
    this.expandedIds.set(next);
  }

  protected expandAll(): void {
    this.expandedIds.set(new Set(this.accounts().filter((a) => a.isGroup).map((a) => a.id)));
  }

  protected collapseAll(): void {
    this.expandedIds.set(new Set());
  }

  protected addChild(a: Account): void {
    this.router.navigate(['/accounts/card'], { queryParams: { parentId: a.id } });
  }

  protected edit(a: Account): void {
    this.router.navigate(['/accounts/card'], { queryParams: { id: a.id } });
  }

  protected async remove(a: Account): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'حذف الحساب',
      message: `سيتم حذف الحساب «${a.code} — ${a.name}» من الدليل. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete(a.id).subscribe({
      next: () => {
        this.toast.success('تم حذف الحساب');
        this.reloadAll();
      },
      error: (err: ApiError) => {
        if (hasErrorCode(err, ACCOUNT_ERROR_CODES.hasPostings)) void this.offerDeactivate(a, err.message);
        else this.toast.error(err.message);
      },
    });
  }

  /** An account with postings can't be deleted — deactivating keeps the ledger intact. */
  private async offerDeactivate(a: Account, serverMessage: string): Promise<void> {
    const reason = serverMessage || `الحساب «${a.code} — ${a.name}» عليه قيود ولا يمكن حذفه.`;
    if (!a.isActive) {
      this.toast.error(`${reason} الحساب موقوف بالفعل.`);
      return;
    }
    const deactivate = await this.dialog.confirm({
      title: 'لا يمكن حذف الحساب',
      message: `${reason}\nهل تريد إيقافه بدلًا من ذلك؟ لن يظهر في القيود والسندات الجديدة، ويبقى رصيده وحركاته كما هي.`,
      confirmText: 'إيقاف الحساب',
      type: 'warning',
    });
    if (!deactivate) return;
    this.api.update(a.id, toAccountPayload(a, { isActive: false })).subscribe(() => {
      this.toast.success(`تم إيقاف «${a.name}»`);
      this.reloadAll();
    });
  }

  protected reloadAll(): void {
    this.chart.reload();
    this.trialBalance.reload();
  }

  protected export(): void {
    downloadCsv('دليل-الحسابات', this.accounts(), [
      { label: 'الكود', value: (a) => a.code },
      { label: 'الحساب', value: (a) => a.name },
      { label: 'الحساب الرئيسي', value: (a) => a.parentName ?? '' },
      { label: 'المستوى', value: (a) => a.level },
      { label: 'النوع', value: (a) => ACCOUNT_TYPE_VIEW[a.type].label },
      { label: 'الطبيعة', value: (a) => ACCOUNT_NATURE_LABEL[a.nature] },
      { label: 'تجميعي', value: (a) => (a.isGroup ? 'نعم' : 'لا') },
      { label: 'مدين', value: (a) => a.totalDebit },
      { label: 'دائن', value: (a) => a.totalCredit },
      { label: 'الرصيد', value: (a) => a.balance },
    ]);
  }

  protected depthGuides(depth: number): number[] {
    return Array.from({ length: depth }, (_, i) => i);
  }
}
