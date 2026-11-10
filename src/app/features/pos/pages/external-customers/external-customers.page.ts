import { ChangeDetectionStrategy, Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { AppValidators } from '../../../../shared/validators/app-validators';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ListToolbarComponent, SortOption } from '../../../../shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { RowTemplateDirective } from '../../../../shared/directives/row-template.directive';
import { createListResource } from '../../../../shared/list/list-resource';
import { UrlListState } from '../../../../shared/list/url-list-state';
import { formatMoney, formatRelative } from '../../../../shared/utils/format.util';
import { Party, PartyPayload } from '../../../parties/models/party.model';
import { PartiesService } from '../../../parties/services/parties.service';


/** Walk-in customers registered from the POS: quick form beside the list. */
@Component({
  selector: 'app-external-customers-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    PaginationComponent,
    IconComponent,
    AvatarComponent,
    FormErrorComponent,
    RowTemplateDirective,
  ],
  templateUrl: './external-customers.page.html',
  styleUrl: './external-customers.page.scss',
})
export class ExternalCustomersPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(PartiesService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly navId = input.required<string>();

  protected readonly state = new UrlListState({ pageSize: 10, defaultSort: { key: 'createdAt', dir: 'desc' } });
  protected readonly list = createListResource(this.state.query, (q) =>
    this.api.list({ ...q, filters: { ...q.filters, kind: 'customer', external: '1' } }),
  );

  protected readonly money = formatMoney;
  protected readonly relative = formatRelative;

  protected readonly sortOptions: SortOption[] = [
    { key: 'createdAt', label: 'تاريخ التسجيل' },
    { key: 'name', label: 'الاسم' },
    { key: 'balance', label: 'الرصيد' },
  ];

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: Party }>>('nameCell');
  private readonly phoneCell = viewChild.required<TemplateRef<{ $implicit: Party }>>('phoneCell');
  private readonly balanceCell = viewChild.required<TemplateRef<{ $implicit: Party }>>('balanceCell');
  private readonly dateCell = viewChild.required<TemplateRef<{ $implicit: Party }>>('dateCell');

  protected readonly columns = computed<TableColumn<Party>[]>(() => [
    { key: 'name', label: 'العميل', sortable: true, cellTemplate: this.nameCell() },
    { key: 'phone', label: 'الموبايل', cellTemplate: this.phoneCell() },
    { key: 'city', label: 'المدينة' },
    { key: 'balance', label: 'الرصيد', sortable: true, align: 'end', cellTemplate: this.balanceCell() },
    { key: 'createdAt', label: 'التسجيل', sortable: true, cellTemplate: this.dateCell() },
  ]);

  /** Party being edited in the side form; null → creating. */
  protected readonly editing = signal<Party | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    phone: ['', [Validators.required, AppValidators.mobile()]],
    city: ['', Validators.maxLength(40)],
    notes: ['', Validators.maxLength(200)],
  });

  protected edit(p: Party): void {
    this.editing.set(p);
    this.form.reset({ name: p.name, phone: p.phone, city: p.city, notes: p.notes });
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.form.reset();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const current = this.editing();
    const payload: PartyPayload = {
      ...(current ? this.payloadOf(current) : this.blankPayload()),
      name: v.name.trim(),
      phone: v.phone.trim(),
      city: v.city.trim(),
      notes: v.notes.trim(),
    };
    this.saving.set(true);
    (current ? this.api.update(current.id, payload) : this.api.create(payload))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((p) => {
        this.toast.success(current ? 'تم تحديث بيانات العميل' : `تم تسجيل العميل ${p.code}`);
        this.cancelEdit();
        this.list.reload();
      });
  }

  protected async promote(p: Party): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'تحويل إلى عميل دائم',
      message: `سيُنقل «${p.name}» إلى قائمة العملاء الدائمين ويمكنك استكمال بياناته من بطاقة العميل. متابعة؟`,
      confirmText: 'تحويل',
      type: 'info',
    });
    if (!ok) return;
    this.api.update(p.id, { ...this.payloadOf(p), isExternal: false }).subscribe(() => {
      this.toast.success('تم التحويل — افتح بطاقة العميل لاستكمال بياناته', {
        action: { label: 'فتح البطاقة', handler: () => this.router.navigate(['/customers/card'], { queryParams: { id: p.id } }) },
      });
      if (this.editing()?.id === p.id) this.cancelEdit();
      this.list.reload();
    });
  }

  protected async remove(p: Party): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'حذف العميل',
      message: `سيتم حذف «${p.name}». لا يمكن حذف عميل عليه فواتير. متابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    this.api.delete(p.id).subscribe(() => {
      this.toast.success('تم حذف العميل');
      if (this.editing()?.id === p.id) this.cancelEdit();
      this.list.reload();
    });
  }

  private blankPayload(): PartyPayload {
    return {
      kind: 'customer',
      name: '',
      phone: '',
      phone2: '',
      email: '',
      city: '',
      address: '',
      taxNumber: '',
      commercialRegister: '',
      creditLimit: 0,
      paymentTermDays: 0,
      priceList: 'retail',
      openingBalance: 0,
      notes: '',
      isActive: true,
      isExternal: true,
    };
  }

  private payloadOf(p: Party): PartyPayload {
    const { kind, name, phone, phone2, email, city, address, taxNumber, commercialRegister, creditLimit, paymentTermDays, priceList, openingBalance, notes, isActive, isExternal } = p;
    return { kind, name, phone, phone2, email, city, address, taxNumber, commercialRegister, creditLimit, paymentTermDays, priceList, openingBalance, notes, isActive, isExternal };
  }
}
