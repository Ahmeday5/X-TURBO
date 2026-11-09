import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { BASE_CURRENCY, Currency, CurrencyPayload } from '../../models/currency.model';
import { CurrenciesService } from '../../services/currencies.service';

/**
 * Create / edit a currency in a modal. `currency` null → create.
 * Emits `saved` after a successful write so the page can refresh.
 */
@Component({
  selector: 'app-currency-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent, IconComponent],
  templateUrl: './currency-form-dialog.component.html',
  styleUrl: './currency-form-dialog.component.scss',
})
export class CurrencyFormDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(CurrenciesService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly currency = input<Currency | null>(null);
  /** Codes already in use (checked locally before hitting the server). */
  readonly takenCodes = input<readonly string[]>([]);

  readonly closed = output<void>();
  readonly saved = output<Currency>();

  protected readonly base = BASE_CURRENCY;
  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => !!this.currency());

  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
    name: ['', [Validators.required, Validators.maxLength(40)]],
    symbol: ['', Validators.maxLength(6)],
    rate: [0, [Validators.required, Validators.min(0.0001)]],
    isActive: [true],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly preview = computed(() => ({ ...this.form.getRawValue(), ...this.value() }));
  protected readonly codeTaken = computed(() => {
    const code = this.preview().code;
    return code.length === 3 && code !== this.currency()?.code && this.takenCodes().includes(code);
  });
  protected readonly rateChange = computed(() => {
    const c = this.currency();
    const rate = Number(this.preview().rate);
    if (!c || !(rate > 0) || rate === c.rate) return null;
    return ((rate - c.rate) / c.rate) * 100;
  });

  constructor() {
    // Re-seed each time the dialog opens.
    effect(() => {
      if (!this.open()) return;
      const c = this.currency();
      untracked(() =>
        this.form.reset(
          c ? { code: c.code, name: c.name, symbol: c.symbol, rate: c.rate, isActive: c.isActive } : { code: '', name: '', symbol: '', rate: 0, isActive: true },
        ),
      );
    });
  }

  protected onCodeInput(el: HTMLInputElement): void {
    const code = el.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    if (code !== el.value) el.value = code;
    this.form.controls.code.setValue(code);
  }

  protected submit(): void {
    if (this.form.invalid || this.codeTaken()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: CurrencyPayload = {
      code: v.code,
      name: v.name.trim(),
      symbol: v.symbol.trim() || v.code,
      rate: Number(v.rate),
      isActive: v.isActive,
    };
    const id = this.currency()?.id;
    this.saving.set(true);
    (id ? this.api.update(id, payload) : this.api.create(payload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((c) => {
        this.toast.success(id ? `تم تحديث ${c.name}` : `تمت إضافة ${c.name} (${c.code})`);
        this.saved.emit(c);
      });
  }

  protected delta(pct: number): string {
    return `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`;
  }
}
