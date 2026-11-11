import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatInteger } from '../../../../shared/utils/format.util';
import { pluralAr } from '../../../../shared/utils/plural.util';
import { PENDING_INVOICES_PLURAL } from '../../utils/pending-review';

/**
 * Attention badge: "N بانتظار المراجعة" on a warehouse that has purchase
 * invoices waiting for the warehouse manager. Pulses (amber) so it can't be
 * missed in a table row or a card; static for users who prefer reduced motion.
 * Clicking opens the review queue — it never triggers the host row / card click.
 */
@Component({
  selector: 'app-pending-review-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button type="button" class="prb" [title]="label()" [attr.aria-label]="label() + ' — فتح قائمة المراجعة'"
      (click)="$event.stopPropagation(); review.emit()">
      <span class="prb__dot" aria-hidden="true"></span>
      <app-icon name="clipboard" [size]="13" />
      <span class="prb__text"><strong>{{ int(count()) }}</strong> بانتظار المراجعة</span>
    </button>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .prb {
        position: relative; display: inline-flex; align-items: center; gap: 6px;
        padding: 3px 10px 3px 9px; border: 1px solid color-mix(in srgb, var(--am) 45%, transparent);
        border-radius: 999px; background: var(--am-l); color: var(--am);
        font: inherit; font-size: 11px; font-weight: 600; white-space: nowrap; cursor: pointer;
        animation: prb-breathe 1.6s ease-in-out infinite;
        transition: transform var(--dur-fast), background var(--dur-fast);
      }
      .prb:hover, .prb:focus-visible {
        outline: none; animation-play-state: paused; transform: translateY(-1px);
        background: color-mix(in srgb, var(--am) 22%, var(--am-l));
      }
      .prb strong { font-weight: 800; font-variant-numeric: tabular-nums; }
      .prb__dot {
        width: 7px; height: 7px; flex-shrink: 0; border-radius: 50%; background: var(--am);
        animation: prb-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      @keyframes prb-breathe {
        0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--am) 0%, transparent); opacity: 1; }
        50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--am) 18%, transparent); opacity: 0.78; }
      }
      @keyframes prb-ping {
        0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--am) 70%, transparent); }
        100% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--am) 0%, transparent); }
      }
      @media (prefers-reduced-motion: reduce) {
        .prb, .prb__dot { animation: none; }
      }
    `,
  ],
})
export class PendingReviewBadgeComponent {
  readonly count = input.required<number>();
  /** Open this warehouse's review queue. */
  readonly review = output<void>();

  protected readonly label = computed(() => `${pluralAr(this.count(), PENDING_INVOICES_PLURAL)} بانتظار المراجعة`);
  protected readonly int = formatInteger;
}
