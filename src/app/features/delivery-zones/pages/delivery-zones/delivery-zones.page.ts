import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { hasErrorCode } from '../../../../core/http/api-error-codes';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SummaryTile, SummaryTilesComponent } from '../../../../shared/components/summary-tiles/summary-tiles.component';
import { createQueryResource } from '../../../../shared/list/query-resource';
import { formatInteger, formatMoney } from '../../../../shared/utils/format.util';
import { ZoneDialogComponent } from '../../components/zone-dialog/zone-dialog.component';
import {
  DELIVERY_ZONE_ERROR_CODES,
  deliveryDaysLabel,
  DeliveryZone,
  EGYPT_GOVERNORATES,
  governorateRank,
  toZonePayload,
} from '../../models/delivery-zone.model';
import { DeliveryZonesService } from '../../services/delivery-zones.service';

/**
 * Delivery zones: shipping fee, delivery estimate and free-shipping threshold
 * per governorate, plus which governorates the app can't deliver to yet.
 * Gated by `Settings.Manage`.
 */
@Component({
  selector: 'app-delivery-zones-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, SummaryTilesComponent, ZoneDialogComponent],
  templateUrl: './delivery-zones.page.html',
  styleUrl: './delivery-zones.page.scss',
})
export class DeliveryZonesPage {
  private readonly api = inject(DeliveryZonesService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly navId = input.required<string>();

  protected readonly money = formatMoney;
  protected readonly days = deliveryDaysLabel;

  protected readonly zones = createQueryResource(signal(0), () => this.api.list(), { errorMessage: 'تعذّر تحميل مناطق التوصيل' });
  protected readonly sorted = computed(() =>
    [...(this.zones.value() ?? [])].sort(
      (a, b) => governorateRank(a.governorate) - governorateRank(b.governorate) || a.governorate.localeCompare(b.governorate, 'ar'),
    ),
  );

  /** Governorates with no zone at all — offered in the "add" picker. */
  protected readonly unzoned = computed(() => {
    const taken = new Set((this.zones.value() ?? []).map((z) => z.governorate));
    return EGYPT_GOVERNORATES.filter((g) => !taken.has(g));
  });
  /** Zones that exist but are switched off. */
  protected readonly inactive = computed(() => this.sorted().filter((z) => !z.isActive));
  protected readonly noDeliveryCount = computed(() => this.unzoned().length + this.inactive().length);

  protected readonly tiles = computed<SummaryTile[]>(() => {
    const list = this.zones.value();
    const active = list?.filter((z) => z.isActive) ?? [];
    const avgFee = active.length ? active.reduce((s, z) => s + z.fee, 0) / active.length : 0;
    return [
      {
        label: 'محافظات بها توصيل',
        icon: 'truck',
        value: list ? active.length : null,
        format: (n) => `${formatInteger(n)} / ${EGYPT_GOVERNORATES.length}`,
        tone: 'var(--gr)',
      },
      {
        label: 'بدون توصيل',
        icon: 'alert',
        value: list ? this.noDeliveryCount() : null,
        format: formatInteger,
        tone: 'var(--am)',
        hint: list && this.noDeliveryCount() ? 'لا يظهر لها توصيل في التطبيق' : undefined,
      },
      { label: 'متوسط الرسوم', icon: 'coins', value: list ? avgFee : null, format: formatMoney },
      {
        label: 'بشحن مجاني',
        icon: 'tag',
        value: list ? active.filter((z) => !!z.freeShippingThreshold).length : null,
        format: formatInteger,
        tone: 'var(--primary)',
      },
    ];
  });

  // ── Dialog ──

  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<DeliveryZone | null>(null);
  protected readonly preset = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);

  protected add(governorate: string | null = null): void {
    this.editing.set(null);
    this.preset.set(governorate);
    this.dialogOpen.set(true);
  }

  protected edit(z: DeliveryZone): void {
    this.editing.set(z);
    this.preset.set(null);
    this.dialogOpen.set(true);
  }

  protected onSaved(): void {
    this.dialogOpen.set(false);
    this.zones.reload();
  }

  // ── Row actions ──

  protected toggle(z: DeliveryZone): void {
    this.busyId.set(z.id);
    this.api.update(z.id, toZonePayload(z, { isActive: !z.isActive })).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(z.isActive ? `تم إيقاف التوصيل إلى ${z.governorate}` : `تم تفعيل التوصيل إلى ${z.governorate}`);
        this.zones.reload();
      },
      error: () => this.busyId.set(null),
    });
  }

  protected async remove(z: DeliveryZone): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'حذف منطقة التوصيل',
      message: `سيتم حذف منطقة ${z.governorate}، ولن يتوفر التوصيل إليها في التطبيق. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    this.busyId.set(z.id);
    this.api.delete(z.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(`تم حذف منطقة ${z.governorate}`);
        this.zones.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (hasErrorCode(err, DELIVERY_ZONE_ERROR_CODES.inUse)) void this.offerDeactivate(z, err.message);
        else this.toast.error(err.message);
      },
    });
  }

  /** A zone used by orders can't be deleted — stopping it keeps the order history valid. */
  private async offerDeactivate(z: DeliveryZone, serverMessage: string): Promise<void> {
    const reason = serverMessage || `منطقة ${z.governorate} مستخدمة في طلبات سابقة.`;
    if (!z.isActive) {
      this.toast.error(`${reason} المنطقة موقوفة بالفعل.`);
      return;
    }
    const deactivate = await this.dialog.confirm({
      title: 'لا يمكن حذف المنطقة',
      message: `${reason}\nهل تريد إيقافها بدلًا من ذلك؟ يتوقف التوصيل إلى ${z.governorate} في التطبيق وتبقى الطلبات السابقة كما هي.`,
      confirmText: 'إيقاف المنطقة',
      type: 'warning',
    });
    if (deactivate) this.toggle(z);
  }
}
