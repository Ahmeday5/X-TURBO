import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { finalize } from 'rxjs';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ApiError } from '../../../../core/models/api-response.model';
import { ToastService } from '../../../../core/services/toast.service';
import { apiErrorToMessage } from '../../../../core/utils/api-error.util';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatMoney } from '../../../../shared/utils/format.util';
import { Item, POS_PRICE_RULE } from '../../models/item.model';
import { ItemsService } from '../../services/items.service';

/** What the editor needs to know about the item. */
export interface PosPriceTarget {
  id: string;
  name: string;
  salePrice: number;
  /** `null` = the item sells at its sale price. */
  posPrice: number | null;
}

/**
 * The cashier price with a quick inline editor (`PATCH items/:id/pos-price`).
 * The app price is never touched. The pencil shows only with Items.View.
 * Emits the updated item so the host can refresh its row / card / cart.
 */
@Component({
  selector: 'app-pos-price-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { '(click)': '$event.stopPropagation()', '(keydown)': 'onHostKey($event)' },
  template: `
    @if (!editing()) {
      <span class="pp">
        <span class="pp__value" [class.is-custom]="isCustom()">{{ money(effective()) }}</span>
        @if (canEdit()) {
          <button type="button" class="pp__pen" [title]="'تعديل سعر نقطة البيع — ' + item().name"
            [attr.aria-label]="'تعديل سعر نقطة البيع لـ ' + item().name" (click)="start()">
            <app-icon name="edit" [size]="12" />
          </button>
        }
      </span>
      @if (showHint()) {
        <small class="pp__hint">{{ isCustom() ? 'سعر خاص بنقطة البيع' : 'نفس سعر البيع' }}</small>
      }
    } @else {
      <form class="pp-edit" (submit)="$event.preventDefault(); save()" novalidate>
        <input #field class="ui-input pp-edit__input" type="number" min="0" step="0.01" inputmode="decimal"
          [value]="draft()" [attr.aria-invalid]="!!error()" [attr.aria-label]="'سعر نقطة البيع لـ ' + item().name"
          (input)="draft.set($any($event.target).value); error.set(null)" />
        <button type="submit" class="ui-icon-btn" title="حفظ" aria-label="حفظ السعر" [class.is-loading]="saving()" [disabled]="saving()">
          <app-icon name="check" [size]="14" />
        </button>
        <button type="button" class="ui-icon-btn" title="إلغاء" aria-label="إلغاء التعديل" [disabled]="saving()" (click)="cancel()">
          <app-icon name="x" [size]="14" />
        </button>
        @if (isCustom()) {
          <button type="button" class="pp-edit__reset" [disabled]="saving()" (click)="save(null)"
            [title]="'يرجع لسعر البيع ' + money(item().salePrice)">نفس سعر البيع</button>
        }
        @if (error(); as e) {<small class="pp-edit__error" role="alert">{{ e }}</small>}
      </form>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; flex-direction: column; align-items: flex-end; gap: 2px; }
      .pp { display: inline-flex; align-items: center; gap: 4px; }
      .pp__value { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--txt); white-space: nowrap; }
      .pp__value.is-custom { color: var(--primary-strong); }
      .pp__pen {
        display: inline-grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 7px;
        background: transparent; color: var(--txt3); cursor: pointer; transition: background var(--dur-fast), color var(--dur-fast);
      }
      .pp__pen:hover { background: var(--bg3); color: var(--primary); }
      .pp__pen:focus-visible { outline: none; box-shadow: var(--focus-ring); }
      .pp__hint { font-size: 10.5px; color: var(--txt3); white-space: nowrap; }
      .pp-edit { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px; max-width: 230px; }
      .pp-edit__input { width: 96px; height: 30px; padding: 4px 8px; font-variant-numeric: tabular-nums; }
      .pp-edit__input[aria-invalid='true'] { border-color: var(--re); }
      .pp-edit__reset { padding: 0; border: 0; background: none; color: var(--primary); font: inherit; font-size: 11px; cursor: pointer; text-decoration: underline; }
      .pp-edit__error { flex-basis: 100%; font-size: 11px; color: var(--re); text-align: end; }
    `,
  ],
})
export class PosPriceEditorComponent {
  private readonly api = inject(ItemsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly item = input.required<PosPriceTarget>();
  /** "نفس سعر البيع" / "سعر خاص" under the price. */
  readonly showHint = input(true);
  readonly saved = output<Item>();

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly canEdit = computed(() => this.auth.hasPermission(PERMISSIONS.items));
  protected readonly isCustom = computed(() => this.item().posPrice !== null);
  protected readonly effective = computed(() => this.item().posPrice ?? this.item().salePrice);

  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly money = formatMoney;

  protected start(): void {
    this.draft.set(String(this.effective()));
    this.error.set(null);
    this.editing.set(true);
    queueMicrotask(() => this.field()?.nativeElement.select());
  }

  protected cancel(): void {
    if (!this.saving()) this.editing.set(false);
  }

  protected onHostKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.editing()) {
      event.stopPropagation();
      this.cancel();
    }
  }

  /** `undefined` → the typed value; `null` → back to the sale price. */
  protected save(value?: null): void {
    const item = this.item();
    let price: number | null = null;
    if (value !== null) {
      const raw = this.draft().trim();
      price = Number(raw);
      if (!raw || !Number.isFinite(price)) {
        this.error.set('اكتب السعر بالأرقام — مثال: 420 أو 420.50');
        return;
      }
      if (price < 0) {
        this.error.set(POS_PRICE_RULE);
        return;
      }
      price = Math.round(price * 100) / 100;
      // Same as the sale price → store "no special price" so it follows future sale-price changes.
      if (price === item.salePrice) price = null;
      if (price === item.posPrice) {
        this.editing.set(false);
        return;
      }
    }

    this.saving.set(true);
    this.api
      .setPosPrice(item.id, price)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.editing.set(false);
          this.toast.success(
            updated.posPrice === null
              ? `«${updated.name}» يُباع في نقطة البيع بسعر البيع ${formatMoney(updated.salePrice)}`
              : `سعر نقطة البيع لـ «${updated.name}» أصبح ${formatMoney(updated.effectivePosPrice)} — سعر التطبيق لم يتغير`,
          );
          this.saved.emit(updated);
        },
        error: (err: ApiError) => {
          if (err.status === 422) this.error.set(apiErrorToMessage(err, POS_PRICE_RULE));
          else this.toast.error(err.message);
        },
      });
  }
}
