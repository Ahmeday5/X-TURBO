import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { IconComponent, IconName } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { formatDateTime } from '../../../../shared/utils/format.util';
import { PartyCardComponent, PartyCardData } from '../../components/party-card/party-card.component';
import { Party, PartyKind, PartyPayload, PRICE_LIST_LABEL, PriceList } from '../../models/party.model';
import { PartiesService } from '../../services/parties.service';

const PHONE_PATTERN = /^01[0125]\d{8}$/;

const KIND_CARDS: ReadonlyArray<{ value: PartyKind; label: string; hint: string; icon: IconName }> = [
  { value: 'customer', label: 'عميل', hint: 'نبيع له ونحصّل منه', icon: 'user' },
  { value: 'supplier', label: 'مورد', hint: 'نشتري منه ونسدد له', icon: 'truck' },
  { value: 'both', label: 'عميل ومورد', hint: 'حساب واحد للتعاملين', icon: 'swap' },
];

/**
 * Customer / supplier card: create, or edit with `?id=` (bound from the URL so
 * a refresh keeps the same record). The aside previews the party card live.
 */
@Component({
  selector: 'app-party-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, IconComponent, FormErrorComponent, PartyCardComponent],
  templateUrl: './party-form.page.html',
  styleUrl: './party-form.page.scss',
})
export class PartyFormPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly parties = inject(PartiesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Bound from route data / query string. */
  readonly navId = input.required<string>();
  readonly id = input<string>();

  protected readonly kinds = KIND_CARDS;
  protected readonly priceLists = Object.entries(PRICE_LIST_LABEL) as Array<[PriceList, string]>;

  protected readonly form = this.fb.group({
    kind: ['customer' as PartyKind, Validators.required],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: ['', Validators.pattern(PHONE_PATTERN)],
    phone2: ['', Validators.pattern(PHONE_PATTERN)],
    email: ['', Validators.email],
    city: ['', Validators.maxLength(60)],
    address: ['', Validators.maxLength(200)],
    taxNumber: ['', Validators.pattern(/^\d{9}$/)],
    commercialRegister: ['', Validators.maxLength(20)],
    priceList: ['retail' as PriceList],
    creditLimit: [0, Validators.min(0)],
    paymentTermDays: [0, [Validators.min(0), Validators.max(365)]],
    openingAmount: [0, Validators.min(0)],
    openingSide: ['debit' as 'debit' | 'credit'],
    notes: ['', Validators.maxLength(500)],
    isActive: [true],
    isExternal: [false],
  });

  protected readonly current = signal<Party | null>(null);
  protected readonly loadingParty = signal(false);
  protected readonly saving = signal<'save' | 'saveNew' | null>(null);
  protected readonly isEdit = computed(() => !!this.id());
  /** Opening balance is locked once the party has movements (server rule). */
  protected readonly openingLocked = computed(() => !!this.current()?.lastMovementAt);

  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly preview = computed<PartyCardData>(() => {
    const v = { ...this.form.getRawValue(), ...this.draft() };
    const cur = this.current();
    return {
      code: cur?.code ?? (v.kind === 'supplier' ? 'SU-جديد' : 'CU-جديد'),
      kind: v.kind,
      name: v.name.trim(),
      phone: v.phone,
      city: v.city,
      priceList: v.priceList,
      creditLimit: Number(v.creditLimit) || 0,
      paymentTermDays: Number(v.paymentTermDays) || 0,
      isActive: v.isActive,
      isExternal: v.isExternal,
      balance: cur ? cur.balance : this.signedOpening(v.openingAmount, v.openingSide),
    };
  });

  protected readonly lastMovement = computed(() => {
    const at = this.current()?.lastMovementAt;
    return at ? formatDateTime(at) : null;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => (id ? this.load(id) : this.resetForCreate()));
    });
  }

  protected setKind(kind: PartyKind): void {
    this.form.controls.kind.setValue(kind);
    // Suppliers usually open with a credit balance, customers with a debit one.
    if (!this.isEdit() && !this.form.controls.openingAmount.value) {
      this.form.controls.openingSide.setValue(kind === 'supplier' ? 'credit' : 'debit');
    }
  }

  protected submit(mode: 'save' | 'saveNew'): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('راجع الحقول المطلوبة قبل الحفظ');
      return;
    }
    const id = this.id();
    const payload = this.payload();
    this.saving.set(mode);
    (id ? this.parties.update(id, payload) : this.parties.create(payload))
      .pipe(finalize(() => this.saving.set(null)))
      .subscribe((party) => {
        this.toast.success(id ? 'تم تحديث البيانات' : `تم إضافة ${party.name} — ${party.code}`);
        if (mode === 'saveNew') this.resetForCreate();
        else this.router.navigate(['/customers/list']);
      });
  }

  private load(id: string): void {
    this.loadingParty.set(true);
    this.parties
      .get(id)
      .pipe(finalize(() => this.loadingParty.set(false)))
      .subscribe({
        next: (p) => {
          this.current.set(p);
          this.form.reset({
            kind: p.kind,
            name: p.name,
            phone: p.phone,
            phone2: p.phone2,
            email: p.email,
            city: p.city,
            address: p.address,
            taxNumber: p.taxNumber,
            commercialRegister: p.commercialRegister,
            priceList: p.priceList,
            creditLimit: p.creditLimit,
            paymentTermDays: p.paymentTermDays,
            openingAmount: Math.abs(p.openingBalance),
            openingSide: p.openingBalance < 0 ? 'credit' : 'debit',
            notes: p.notes,
            isActive: p.isActive,
            isExternal: p.isExternal,
          });
        },
        error: () => this.router.navigate(['/customers/card'], { replaceUrl: true }),
      });
  }

  private resetForCreate(): void {
    this.current.set(null);
    this.form.reset();
    if (this.id()) this.router.navigate([], { queryParams: { id: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private signedOpening(amount: number, side: 'debit' | 'credit'): number {
    const n = Math.abs(Number(amount) || 0);
    return side === 'credit' ? -n : n;
  }

  private payload(): PartyPayload {
    const { openingAmount, openingSide, ...v } = this.form.getRawValue();
    return {
      ...v,
      name: v.name.trim(),
      email: v.email.trim(),
      city: v.city.trim(),
      address: v.address.trim(),
      notes: v.notes.trim(),
      creditLimit: Number(v.creditLimit) || 0,
      paymentTermDays: Number(v.paymentTermDays) || 0,
      // An unchanged opening on a used party must be sent back exactly as stored.
      openingBalance: this.openingLocked() ? this.current()!.openingBalance : this.signedOpening(openingAmount, openingSide),
    };
  }
}
