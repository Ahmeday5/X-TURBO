import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';
import { matchesAll, tokenize } from '../../../../shared/utils/arabic-search.util';
import { formatInteger, formatMoney } from '../../../../shared/utils/format.util';
import { ItemLookup } from '../../../warehouses/models/stock.model';

const MAX_RESULTS = 8;

/**
 * Add-a-line search box: matches code, barcode and name (Arabic-aware).
 * ↑/↓ to move, Enter to add; an exact barcode / code match is added at
 * once, so a scanner can feed lines without touching the mouse. Focus
 * stays in the box for the next item.
 */
@Component({
  selector: 'app-item-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ClickOutsideDirective],
  template: `
    <div class="ip" (appClickOutside)="open.set(false)">
      <div class="input-icon ip__box">
        <app-icon class="input-icon__glyph" name="search" [size]="16" />
        <input #box class="ui-input" type="search" autocomplete="off" [disabled]="disabled()"
          [placeholder]="loading() ? 'جارٍ تحميل الأصناف…' : 'أضف صنفًا: اكتب الاسم أو الكود أو امسح الباركود…'"
          [value]="term()" (input)="onType($any($event.target).value)" (focus)="open.set(!!term())"
          (keydown.arrowDown)="move(1, $event)" (keydown.arrowUp)="move(-1, $event)"
          (keydown.enter)="choose(results()[active()], $event)" (keydown.escape)="open.set(false)"
          role="combobox" aria-label="بحث عن صنف" [attr.aria-expanded]="open() && !!term()" aria-controls="ip-list" />
        <span class="ip__kbd" aria-hidden="true"><app-icon name="barcode" [size]="15" /></span>
      </div>

      @if (open() && term()) {
        <ul id="ip-list" class="ip__list" role="listbox">
          @for (it of results(); track it.id; let i = $index) {
            <li role="option" [attr.aria-selected]="i === active()" [class.is-active]="i === active()"
              (mouseenter)="active.set(i)" (mousedown)="choose(it, $event)">
              <span class="ip__dot" [style.background]="it.groupColor"></span>
              <div class="ip__name">
                <strong>{{ it.name }}</strong>
                <small><span class="ui-code ltr">{{ it.code }}</span> · {{ it.groupName }}</small>
              </div>
              <div class="ip__meta">
                <strong>{{ money(priceOf()(it)) }}</strong>
                <small [class.is-low]="it.available <= 0">متاح {{ int(it.available) }} {{ it.unit }}</small>
              </div>
            </li>
          } @empty {
            <li class="ip__empty">لا يوجد صنف مطابق لـ«{{ term() }}»</li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .ip { position: relative; }
      .ip__box .ui-input { padding-inline: 38px 40px; height: 44px; }
      .ip__kbd { position: absolute; inset-inline-end: 12px; top: 50%; transform: translateY(-50%); color: var(--txt3); }
      .ip__list {
        position: absolute; z-index: 30; inset-inline: 0; top: calc(100% + 6px); margin: 0; padding: 6px;
        list-style: none; background: var(--bg-elevated); border: 1px solid var(--brd2); border-radius: 14px;
        box-shadow: var(--shadow-lg); max-height: 360px; overflow-y: auto;
        animation: ip-in 0.18s var(--ease-out);
      }
      .ip__list li {
        display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; cursor: pointer;
        transition: background var(--dur-fast);
      }
      .ip__list li.is-active { background: var(--primary-soft); }
      .ip__dot { flex-shrink: 0; width: 8px; height: 8px; border-radius: 50%; }
      .ip__name { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .ip__name strong { font-size: 12.5px; color: var(--txt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ip__name small, .ip__meta small { font-size: 11px; color: var(--txt3); }
      .ip__meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; white-space: nowrap; }
      .ip__meta strong { font-size: 12.5px; color: var(--txt); font-variant-numeric: tabular-nums; }
      .ip__meta small.is-low { color: var(--re); }
      .ip__list li.ip__empty { cursor: default; justify-content: center; color: var(--txt3); font-size: 12px; padding: 14px; }
      @keyframes ip-in { from { opacity: 0; transform: translateY(-4px); } }
    `,
  ],
})
export class ItemPickerComponent {
  readonly items = input.required<readonly ItemLookup[]>();
  readonly priceOf = input.required<(item: ItemLookup) => number>();
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly picked = output<ItemLookup>();

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');
  protected readonly term = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(0);

  protected readonly money = formatMoney;
  protected readonly int = formatInteger;

  protected readonly results = computed(() => {
    const tokens = tokenize(this.term());
    if (!tokens.length) return [];
    return this.items()
      .filter((i) => matchesAll([i.name, i.code, i.barcode, i.brand, i.groupName], tokens))
      .slice(0, MAX_RESULTS);
  });

  protected onType(value: string): void {
    this.term.set(value);
    this.active.set(0);
    this.open.set(!!value.trim());
    // Scanner / exact code: add immediately.
    const exact = value.trim().toLowerCase();
    const hit = exact.length >= 5 ? this.items().find((i) => i.barcode === exact || i.code.toLowerCase() === exact) : undefined;
    if (hit) this.choose(hit);
  }

  protected move(step: number, event: Event): void {
    event.preventDefault();
    const n = this.results().length;
    if (n) this.active.set((this.active() + step + n) % n);
  }

  protected choose(item: ItemLookup | undefined, event?: Event): void {
    event?.preventDefault();
    if (!item) return;
    this.picked.emit(item);
    this.term.set('');
    this.open.set(false);
    this.box().nativeElement.value = '';
    this.box().nativeElement.focus();
  }
}
