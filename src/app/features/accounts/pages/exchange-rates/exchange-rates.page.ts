import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, input, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DeltaComponent } from '../../../../shared/components/delta/delta.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SparklineComponent } from '../../../../shared/components/charts/sparkline/sparkline.component';
import { SummaryTile, SummaryTilesComponent } from '../../../../shared/components/summary-tiles/summary-tiles.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { matchesAll, tokenize } from '../../../../shared/utils/arabic-search.util';
import { formatDateTime, formatInteger, formatRelative } from '../../../../shared/utils/format.util';
import { CurrencyFormDialogComponent } from '../../components/currency-form-dialog/currency-form-dialog.component';
import { BASE_CURRENCY, Currency, CurrencyPayload } from '../../models/currency.model';
import { CurrenciesService } from '../../services/currencies.service';

type StatusFilter = 'all' | 'active' | 'inactive';

const rateFmt = new Intl.NumberFormat('ar-EG-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const amountFmt = new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 2 });

const payloadOf = (c: Currency, patch: Partial<CurrencyPayload> = {}): CurrencyPayload => ({
  code: c.code,
  name: c.name,
  symbol: c.symbol,
  rate: c.rate,
  isActive: c.isActive,
  ...patch,
});

/**
 * Currency exchange rates against the base currency (EGP): one card per
 * currency with its trend, quick rate updates, create / edit modal and a
 * converter.
 */
@Component({
  selector: 'app-exchange-rates-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyFormDialogComponent, DeltaComponent, IconComponent, PageHeaderComponent, SparklineComponent, SummaryTilesComponent],
  templateUrl: './exchange-rates.page.html',
  styleUrl: './exchange-rates.page.scss',
})
export class ExchangeRatesPage {
  private readonly api = inject(CurrenciesService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  /** Bound from route data. */
  readonly navId = input.required<string>();

  protected readonly list = createQueryResource(signal(0), () => this.api.list(), { errorMessage: 'تعذّر تحميل العملات' });
  protected readonly currencies = computed(() => this.list.value() ?? []);
  protected readonly base = computed(() => this.currencies().find((c) => c.isBase) ?? null);
  protected readonly baseCode = BASE_CURRENCY;
  private readonly foreign = computed(() => this.currencies().filter((c) => !c.isBase));

  protected readonly rate = (n: number): string => rateFmt.format(n);
  protected readonly relative = formatRelative;
  protected readonly dateTime = formatDateTime;

  // ── Filters ──
  protected readonly term = signal('');
  protected readonly status = signal<StatusFilter>('all');
  protected readonly visible = computed(() => {
    const tokens = tokenize(this.term());
    const status = this.status();
    return this.foreign().filter(
      (c) =>
        (status === 'all' || c.isActive === (status === 'active')) &&
        (!tokens.length || matchesAll([c.code, c.name, c.symbol], tokens)),
    );
  });

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const ready = !!this.list.value();
    const f = this.foreign().filter((c) => c.isActive);
    const usd = this.currencies().find((c) => c.code === 'USD');
    const latest = this.foreign().reduce<string | null>((a, c) => (!a || c.updatedAt > a ? c.updatedAt : a), null);
    return [
      {
        label: 'العملات النشطة',
        icon: 'coins',
        value: ready ? f.length : null,
        format: formatInteger,
        hint: latest ? `آخر تحديث ${formatRelative(latest)}` : undefined,
      },
      { label: 'ارتفع سعرها', icon: 'trend-up', value: ready ? f.filter((c) => c.changePct > 0).length : null, format: formatInteger, tone: 'var(--gr)' },
      { label: 'انخفض سعرها', icon: 'trend-down', value: ready ? f.filter((c) => c.changePct < 0).length : null, format: formatInteger, tone: 'var(--re)' },
      {
        label: 'سعر الدولار',
        icon: 'wallet',
        value: ready && usd ? usd.rate : null,
        format: (v) => `${rateFmt.format(v)} ج.م`,
        tone: 'var(--bl)',
        hint: usd ? `السابق ${rateFmt.format(usd.previousRate)}` : undefined,
      },
    ];
  });

  // ── Create / edit ──
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Currency | null>(null);
  protected readonly codes = computed(() => this.currencies().map((c) => c.code));

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(c: Currency): void {
    if (c.isBase) return;
    this.editing.set(c);
    this.formOpen.set(true);
  }

  protected onSaved(): void {
    this.formOpen.set(false);
    this.list.reload();
  }

  // ── Quick rate update ──
  protected readonly quickId = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected startQuick(c: Currency): void {
    this.quickId.set(c.id);
    afterNextRender(
      () => {
        const el = this.host.nativeElement.querySelector<HTMLInputElement>('.xr-quick input');
        el?.focus();
        el?.select();
      },
      { injector: this.injector },
    );
  }

  protected saveQuick(c: Currency, raw: string): void {
    const rate = Math.round(Number(raw) * 10_000) / 10_000;
    if (!(rate > 0)) {
      this.toast.warning('سعر الصرف يجب أن يكون أكبر من صفر');
      return;
    }
    if (rate === c.rate) {
      this.quickId.set(null);
      return;
    }
    this.write(c, { rate }, (u) => {
      this.quickId.set(null);
      this.toast.success(`سعر ${u.code} الآن ${rateFmt.format(u.rate)} ج.م`);
    });
  }

  protected toggleActive(c: Currency): void {
    if (c.isBase) return;
    this.write(c, { isActive: !c.isActive }, (u) => this.toast.success(u.isActive ? `تم تفعيل ${u.name}` : `تم إيقاف ${u.name}`));
  }

  private write(c: Currency, patch: Partial<CurrencyPayload>, done: (u: Currency) => void): void {
    this.busyId.set(c.id);
    this.api
      .update(c.id, payloadOf(c, patch))
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe((u) => {
        done(u);
        this.list.reload();
      });
  }

  protected async remove(c: Currency): Promise<void> {
    if (c.isBase) return;
    const confirmed = await this.dialog.confirm({
      title: 'حذف العملة',
      message: `سيتم حذف «${c.name} (${c.code})» وسجل أسعارها. العملات المستخدمة في حسابات لا تُحذف — يمكن إيقافها. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!confirmed) return;
    this.api.delete(c.id).subscribe(() => {
      this.toast.success(`تم حذف ${c.name}`);
      if (this.from() === c.code) this.from.set(BASE_CURRENCY);
      if (this.to() === c.code) this.to.set(BASE_CURRENCY);
      this.list.reload();
    });
  }

  // ── Converter ──
  protected readonly amount = signal(100);
  protected readonly from = signal('USD');
  protected readonly to = signal<string>(BASE_CURRENCY);
  protected readonly convertible = computed(() => this.currencies().filter((c) => c.isActive || c.isBase));

  protected readonly conversion = computed(() => {
    const all = this.currencies();
    const from = all.find((c) => c.code === this.from());
    const to = all.find((c) => c.code === this.to());
    if (!from || !to) return null;
    const unit = from.rate / to.rate;
    return {
      from,
      to,
      result: this.amount() * unit,
      unit: `1 ${from.code} = ${rateFmt.format(unit)} ${to.code}`,
      inverse: `1 ${to.code} = ${rateFmt.format(1 / unit)} ${from.code}`,
    };
  });

  protected setAmount(raw: string): void {
    const n = Number(raw);
    this.amount.set(Number.isFinite(n) ? n : 0);
  }

  protected swap(): void {
    const f = this.from();
    this.from.set(this.to());
    this.to.set(f);
  }

  protected formatAmount(n: number): string {
    return amountFmt.format(n);
  }
}
