import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { deliveryView, OrderDelivery } from '../../models/delivery-type.model';

/**
 * Delivery type of an order — a coloured badge (standard grey, express red,
 * scheduled blue) with the booked slot under it when there is one.
 *
 *   <app-delivery-badge [delivery]="order.delivery" />
 *   <app-delivery-badge [delivery]="order.delivery" [showSlot]="false" size="lg" />
 */
@Component({
  selector: 'app-delivery-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (view(); as v) {
      <span class="db" [class.db--urgent]="v.urgent" [class.db--lg]="size() === 'lg'" [style.--c]="v.color">
        <app-icon [name]="v.icon" [size]="size() === 'lg' ? 14 : 12" />
        {{ v.label }}
      </span>
      @if (showSlot() && delivery()?.slot; as slot) {
        <small class="db__slot" [title]="slot.label">{{ slot.label }}</small>
      }
    } @else {
      <span class="db__none">—</span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }
      .db {
        --c: var(--txt3);
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 9px; border-radius: 999px;
        background: color-mix(in srgb, var(--c) 13%, transparent);
        color: var(--c);
        font-size: 11.5px; font-weight: 700; white-space: nowrap;
      }
      .db--lg { padding: 4px 12px; font-size: 13px; }
      /* Express must stand out: solid fill + a soft pulse ring. */
      .db--urgent {
        background: var(--c); color: #fff;
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 45%, transparent);
        animation: db-pulse 2.2s ease-out infinite;
      }
      .db__slot {
        max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: 11px; font-weight: 600; color: var(--bl);
      }
      .db__none { color: var(--txt3); }
      @keyframes db-pulse {
        0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 45%, transparent); }
        70%, 100% { box-shadow: 0 0 0 6px transparent; }
      }
      @media (prefers-reduced-motion: reduce) { .db--urgent { animation: none; } }
    `,
  ],
})
export class DeliveryBadgeComponent {
  /** `null` (e.g. a POS sale) renders "—". */
  readonly delivery = input<OrderDelivery | null | undefined>(null);
  readonly showSlot = input(true);
  readonly size = input<'sm' | 'lg'>('sm');

  protected readonly view = computed(() => {
    const d = this.delivery();
    return d ? deliveryView(d) : null;
  });
}
