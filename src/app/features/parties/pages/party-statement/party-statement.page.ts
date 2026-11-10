import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { DateRange, DateRangeComponent } from '../../../../shared/components/date-range/date-range.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import { StatusPillComponent } from '../../../../shared/components/status-pill/status-pill.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { downloadCsv } from '../../../../shared/utils/csv.util';
import { formatDateTime, formatDayMonth, formatInteger, formatMoney } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { PrintStylesComponent } from '../../components/print-styles/print-styles.component';
import {
  BALANCE_SIDE_LABEL,
  balanceSide,
  DetailedStatementEntry,
  PARTY_KIND_VIEW,
  PartyStatement,
  StatementEntry,
} from '../../models/party.model';
import { PartiesService } from '../../services/parties.service';
import { formatBalance, statementSourceLabel, statementSourceLink } from '../../utils/party-display.util';

const DETAILED_NAV_ID = 'customers.statement-detailed';

const ENTRIES_PLURAL = { one: 'حركة واحدة', two: 'حركتان', few: '# حركات', other: '# حركة' };

interface StatementQuery {
  partyId: string;
  from: string | null;
  to: string | null;
  detailed: boolean;
}

/**
 * Party account statement (`/customers/statement`) and its detailed variant
 * (`/customers/statement-detailed`, every invoice expands to its lines).
 * Party and range live in the URL: `?partyId=&from=&to=`.
 */
@Component({
  selector: 'app-party-statement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DateRangeComponent,
    IconComponent,
    PageHeaderComponent,
    PrintStylesComponent,
    SearchableSelectComponent,
    StatusPillComponent,
  ],
  templateUrl: './party-statement.page.html',
  styleUrl: './party-statement.page.scss',
})
export class PartyStatementPage {
  private readonly parties = inject(PartiesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly navId = input.required<string>();

  private readonly url = new UrlListState();
  protected readonly partyId = this.url.param('partyId');
  protected readonly from = this.url.param('from');
  protected readonly to = this.url.param('to');

  protected readonly detailed = computed(() => this.navId() === DETAILED_NAV_ID);
  /** The other statement variant, same party and range. */
  protected readonly otherRoute = computed(() => (this.detailed() ? '/customers/statement' : '/customers/statement-detailed'));

  protected readonly partyControl = new FormControl<string | null>(null);
  private readonly options = toSignal(this.parties.lookup(), { initialValue: [] });
  protected readonly partyOptions = computed<SearchableSelectOption[]>(() =>
    this.options().map((p) => ({ value: p.id, label: `${p.name} — ${p.code}`, hint: `${PARTY_KIND_VIEW[p.kind].label} · ${p.phone}` })),
  );

  private readonly query = computed<StatementQuery>(
    () => ({ partyId: this.partyId(), from: this.from() || null, to: this.to() || null, detailed: this.detailed() }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly statement = createQueryResource(
    this.query,
    (q): Observable<PartyStatement<StatementEntry | DetailedStatementEntry>> =>
      q.detailed ? this.parties.statementDetailed(q.partyId, q) : this.parties.statement(q.partyId, q),
    { enabled: (q) => !!q.partyId, errorMessage: 'تعذّر تحميل كشف الحساب' },
  );

  /** Expanded entry ids (detailed view). */
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly entriesLabel = computed(() => pluralAr(this.statement.value()?.entries.length ?? 0, ENTRIES_PLURAL));
  protected readonly withLines = computed(
    () => (this.statement.value()?.entries ?? []).filter((e) => 'lines' in e && (e as DetailedStatementEntry).lines.length).map((e) => this.key(e)),
  );
  protected readonly allExpanded = computed(() => {
    const ids = this.withLines();
    return ids.length > 0 && ids.every((id) => this.expanded().has(id));
  });

  protected readonly money = formatMoney;
  protected readonly day = formatDayMonth;
  protected readonly balance = formatBalance;
  protected readonly sideLabel = (b: number) => BALANCE_SIDE_LABEL[balanceSide(b)];
  protected readonly sourceLink = statementSourceLink;
  protected readonly sourceLabel = statementSourceLabel;
  protected readonly kindView = PARTY_KIND_VIEW;
  /** Cairo time, like every other timestamp in the app. */
  protected readonly printedAt = formatDateTime(new Date().toISOString());

  constructor() {
    // URL → select (back / forward, links from other pages).
    effect(() => {
      const id = this.partyId() || null;
      untracked(() => {
        if (this.partyControl.value !== id) this.partyControl.setValue(id, { emitEvent: false });
      });
    });
    this.partyControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.expanded.set(new Set());
      this.url.setParam('partyId', id);
    });
  }

  protected setRange(r: DateRange): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: r.from, to: r.to },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected key(e: StatementEntry): string {
    return `${e.sourceId}:${e.debit}:${e.credit}`;
  }

  protected linesOf(e: StatementEntry): DetailedStatementEntry['lines'] {
    return (e as DetailedStatementEntry).lines ?? [];
  }

  protected toggle(e: StatementEntry): void {
    const id = this.key(e);
    const next = new Set(this.expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expanded.set(next);
  }

  protected toggleAll(): void {
    this.expanded.set(this.allExpanded() ? new Set() : new Set(this.withLines()));
  }

  protected print(): void {
    if (this.detailed() && !this.allExpanded()) this.expanded.set(new Set(this.withLines()));
    setTimeout(() => window.print());
  }

  protected export(): void {
    const s = this.statement.value();
    if (!s) return;
    const rows: Array<{ date: string; number: string; type: string; description: string; debit: number; credit: number; balance: number }> = [
      { date: s.from || '', number: '', type: '', description: 'رصيد أول المدة', debit: 0, credit: 0, balance: s.openingBalance },
      ...s.entries.map((e) => ({
        date: e.date,
        number: e.number,
        type: statementSourceLabel(e),
        description: e.description,
        debit: e.debit,
        credit: e.credit,
        balance: e.balance,
      })),
    ];
    downloadCsv(`statement-${s.party.code}-${s.to}`, rows, [
      { label: 'التاريخ', value: (r) => r.date },
      { label: 'رقم المستند', value: (r) => r.number },
      { label: 'النوع', value: (r) => r.type },
      { label: 'البيان', value: (r) => r.description },
      { label: 'مدين', value: (r) => r.debit },
      { label: 'دائن', value: (r) => r.credit },
      { label: 'الرصيد', value: (r) => Math.abs(r.balance) },
      { label: 'طبيعة الرصيد', value: (r) => BALANCE_SIDE_LABEL[balanceSide(r.balance)] },
    ]);
  }

  protected readonly integer = formatInteger;
}
