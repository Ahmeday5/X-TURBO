import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SCAN_HINT, SCAN_PLACEHOLDER } from '../../../../shared/barcode/scan-hint.const';
import { findByScan } from '../../../../shared/barcode/scan-match';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';
import { matchesAll, tokenize } from '../../../../shared/utils/arabic-search.util';
import { formatInteger, formatMoney } from '../../../../shared/utils/format.util';
import { ItemLookup } from '../../../warehouses/models/stock.model';

/** Rows rendered at once; the footer says how many more match. */
const MAX_RESULTS = 50;

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
          [placeholder]="loading() ? 'جارٍ تحميل الأصناف…' : scanPlaceholder" [title]="scanHint"
          [value]="term()" (input)="onType($any($event.target).value)" (focus)="openList()" (click)="openList()"
          (keydown.arrowDown)="open() ? move(1, $event) : openList()" (keydown.arrowUp)="move(-1, $event)"
          (keydown.enter)="onEnter($event)" (keydown.escape)="open.set(false)"
          role="combobox" aria-label="بحث عن صنف" aria-autocomplete="list" [attr.aria-expanded]="open()" aria-controls="ip-list" />
        <span class="ip__kbd" [title]="scanHint"><app-icon name="barcode" [size]="15" /></span>
        <button type="button" class="ip__toggle" [class.is-open]="open()" [disabled]="disabled()" tabindex="-1"
          [attr.aria-label]="open() ? 'إغلاق قائمة الأصناف' : 'عرض كل الأصناف'" (mousedown)="$event.preventDefault()"
          (click)="toggleList()">
          <app-icon name="chevron-down" [size]="16" />
        </button>
      </div>

      @if (open()) {
        <ul id="ip-list" class="ip__list" role="listbox">
          <li class="ip__head" aria-hidden="true">
            {{ term() ? 'نتائج البحث' : 'كل الأصناف' }} · {{ int(results().length + hiddenCount()) }}
          </li>
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
            <li class="ip__empty">
              {{ term() ? 'لا يوجد صنف مطابق لـ«' + term() + '»' : loading() ? 'جارٍ تحميل الأصناف…' : 'لا توجد أصناف متاحة في هذا المخزن' }}
            </li>
          }
          @if (hiddenCount() > 0) {
            <li class="ip__more" aria-hidden="true">
              يتم عرض {{ int(results().length) }} من {{ int(results().length + hiddenCount()) }} — اكتب جزءًا من الاسم أو الكود للتضييق
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .ip { position: relative; }
      .ip__box .ui-input { padding-inline: 38px 72px; height: 44px; }
      .ip__kbd { position: absolute; inset-inline-end: 44px; top: 50%; transform: translateY(-50%); color: var(--txt3); }
      .ip__toggle {
        position: absolute; inset-inline-end: 6px; top: 50%; transform: translateY(-50%);
        display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 9px;
        background: transparent; color: var(--txt3); cursor: pointer; transition: background var(--dur-fast), color var(--dur-fast);
      }
      .ip__toggle:hover:not(:disabled) { background: var(--bg3); color: var(--txt); }
      .ip__toggle app-icon { transition: transform var(--dur-fast); }
      .ip__toggle.is-open app-icon { transform: rotate(180deg); }
      .ip__list li.ip__head {
        cursor: default; padding: 4px 10px 8px; font-size: 11px; font-weight: 600; color: var(--txt3);
      }
      .ip__list li.ip__more {
        cursor: default; justify-content: center; margin-top: 4px; padding: 10px; border-top: 1px dashed var(--brd);
        border-radius: 0; font-size: 11.5px; color: var(--txt3); text-align: center;
      }
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
  protected readonly scanHint = SCAN_HINT;
  protected readonly scanPlaceholder = SCAN_PLACEHOLDER;

  /** Every match (all items while the box is empty): in stock first, then by name. */
  private readonly matches = computed(() => {
    const tokens = tokenize(this.term());
    const list = tokens.length
      ? this.items().filter((i) => matchesAll([i.name, i.code, i.barcode, i.brand, i.groupName], tokens))
      : this.items();
    return [...list].sort((a, b) => Number(b.available > 0) - Number(a.available > 0) || a.name.localeCompare(b.name, 'ar'));
  });
  /** Rendered rows — capped so a large catalogue stays fast; typing narrows it. */
  protected readonly results = computed(() => this.matches().slice(0, MAX_RESULTS));
  protected readonly hiddenCount = computed(() => this.matches().length - this.results().length);

  protected openList(): void {
    if (this.disabled()) return;
    this.open.set(true);
  }

  protected toggleList(): void {
    if (this.disabled()) return;
    this.open.update((o) => !o);
    this.box().nativeElement.focus();
  }

  protected onType(value: string): void {
    this.term.set(value);
    this.active.set(0);
    this.open.set(true);
  }

  /**
   * Enter: an exact barcode / code wins (that's what a scanner sends, followed
   * by Enter); otherwise the highlighted result. Nothing is ever added while
   * typing — a partial scan could equal another item's shorter code.
   */
  protected onEnter(event: Event): void {
    event.preventDefault();
    const exact = findByScan(this.items(), this.term());
    this.choose(exact ?? this.results()[this.active()]);
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
    this.active.set(0);
    this.box().nativeElement.value = '';
    // Keep the list open: several lines are usually added in a row.
    this.box().nativeElement.focus();
  }
}
