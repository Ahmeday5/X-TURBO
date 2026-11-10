import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { ApiError } from '../../../../core/models/api-response.model';
import { applyServerErrors } from '../../../../core/utils/api-error.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { formatDateTime } from '../../../../shared/utils/format.util';
import { DOC_PAYMENT_LABEL } from '../../../documents/models/document.model';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { ReceiptComponent, ReceiptData } from '../../components/receipt/receipt.component';
import {
  POS_CASH_ACCOUNTS,
  POS_PAYMENT_METHODS,
  PosPaymentMethod,
  PosSettings,
  PosSettingsPayload,
} from '../../models/pos-settings.model';
import { PosSettingsService } from '../../services/pos-settings.service';

/** POS configuration with a live receipt preview. */
@Component({
  selector: 'app-pos-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PageHeaderComponent, IconComponent, FormErrorComponent, ReceiptComponent],
  templateUrl: './pos-settings.page.html',
  styleUrl: './pos-settings.page.scss',
})
export class PosSettingsPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(PosSettingsService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  protected readonly warehouses = toSignal(inject(WarehousesService).lookup(), { initialValue: [] });
  protected readonly cashAccounts = POS_CASH_ACCOUNTS;
  protected readonly methods = POS_PAYMENT_METHODS;
  protected readonly methodLabel = DOC_PAYMENT_LABEL;
  protected readonly dateTime = formatDateTime;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly current = signal<PosSettings | null>(null);

  protected readonly form = this.fb.group({
    warehouseId: [''],
    cashAccountId: ['acc-1105', Validators.required],
    paymentMethods: [['cash'] as PosPaymentMethod[]],
    defaultTaxPct: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    allowDiscount: [true],
    maxDiscountPct: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
    receiptHeader: ['', Validators.maxLength(300)],
    receiptFooter: ['', Validators.maxLength(300)],
    paperWidth: [80 as 58 | 80],
    autoPrint: [false],
  });

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Sample sale rendered with the current form values. */
  protected readonly preview = computed<ReceiptData>(() => {
    const v = { ...this.form.getRawValue(), ...this.draft() };
    const tax = Number(v.defaultTaxPct) || 0;
    const lines = [
      { name: 'تيل فرامل أمامي — تويوتا كورولا', qty: 1, price: 1450, discountPct: 0, total: 1450 },
      { name: 'فلتر زيت — هيونداي إلنترا', qty: 2, price: 220, discountPct: 0, total: 440 },
    ];
    const subtotal = 1890;
    const taxAmount = Math.round(subtotal * tax) / 100;
    const total = subtotal + taxAmount;
    const wh = this.warehouses().find((w) => w.id === v.warehouseId) ?? this.warehouses().find((w) => w.isDefault);
    return {
      header: v.receiptHeader ?? '',
      footer: v.receiptFooter ?? '',
      number: 'SI-000000',
      at: new Date().toISOString(),
      cashier: 'اسم الكاشير',
      customer: null,
      warehouse: wh?.name ?? '—',
      lines,
      subtotal,
      discount: 0,
      taxPct: tax,
      tax: taxAmount,
      total,
      paid: total,
      change: 2000 - total > 0 ? 2000 - total : 0,
      remaining: 0,
      methodLabel: DOC_PAYMENT_LABEL.cash,
      paperWidth: v.paperWidth === 58 ? 58 : 80,
    };
  });

  constructor() {
    this.api
      .get()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((s) => this.apply(s));
  }

  protected hasMethod(m: PosPaymentMethod): boolean {
    return (this.draft().paymentMethods ?? this.form.controls.paymentMethods.value).includes(m);
  }

  protected toggleMethod(m: PosPaymentMethod): void {
    const ctrl = this.form.controls.paymentMethods;
    const set = new Set(ctrl.value);
    if (set.has(m)) set.delete(m);
    else set.add(m);
    ctrl.setValue(POS_PAYMENT_METHODS.filter((x) => set.has(x)));
    ctrl.markAsDirty();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('راجع الحقول المطلوبة قبل الحفظ');
      return;
    }
    const v = this.form.getRawValue();
    if (!v.paymentMethods.length) {
      this.toast.warning('فعّل طريقة دفع واحدة على الأقل');
      return;
    }
    const payload: PosSettingsPayload = {
      ...v,
      warehouseId: v.warehouseId || null,
      defaultTaxPct: Number(v.defaultTaxPct),
      maxDiscountPct: Number(v.maxDiscountPct),
      paperWidth: Number(v.paperWidth) === 58 ? 58 : 80,
    };
    this.saving.set(true);
    this.api
      .save(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (s) => {
          this.apply(s);
          this.toast.success('تم حفظ إعدادات نقطة البيع');
        },
        error: (err: ApiError) => applyServerErrors(this.form, err),
      });
  }

  protected reset(): void {
    const s = this.current();
    if (s) this.apply(s);
  }

  private apply(s: PosSettings): void {
    this.current.set(s);
    this.form.reset({
      warehouseId: s.warehouseId ?? '',
      cashAccountId: s.cashAccountId,
      paymentMethods: [...s.paymentMethods],
      defaultTaxPct: s.defaultTaxPct,
      allowDiscount: s.allowDiscount,
      maxDiscountPct: s.maxDiscountPct,
      receiptHeader: s.receiptHeader,
      receiptFooter: s.receiptFooter,
      paperWidth: s.paperWidth,
      autoPrint: s.autoPrint,
    });
  }
}
