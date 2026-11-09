import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ORDER_FLOW, ORDER_STATUS_VIEW, OrderStatus } from '../../models/order.model';

/**
 * Fulfilment stepper (pending → processing → shipped → delivered). The fill
 * animates to the current step; a cancelled order turns the track red.
 * `compact` drops the labels — for cards.
 */
@Component({
  selector: 'app-order-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="op" [class.op--compact]="compact()" [class.is-cancelled]="cancelled()"
      role="progressbar" [attr.aria-valuemin]="0" [attr.aria-valuemax]="steps.length - 1"
      [attr.aria-valuenow]="reached()" [attr.aria-valuetext]="view[status()].label">
      <div class="op__track"><span class="op__fill" [style.--p]="fill()"></span></div>
      <ol class="op__steps">
        @for (s of steps; track s; let i = $index) {
          <li class="op__step" [class.is-done]="i <= reached()" [class.is-current]="i === reached() && !cancelled()" [style.--i]="i">
            <span class="op__dot">
              @if (i <= reached()) { <app-icon [name]="cancelled() && i === reached() ? 'x' : 'check'" [size]="compact() ? 9 : 12" /> }
            </span>
            @if (!compact()) { <span class="op__label">{{ view[s].label }}</span> }
          </li>
        }
      </ol>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .op { position: relative; --dot: 26px; --tone: var(--gr); }
      .op.is-cancelled { --tone: var(--re); }
      .op--compact { --dot: 16px; }
      .op__track {
        position: absolute; inset-inline: calc(var(--dot) / 2); top: calc(var(--dot) / 2 - 2px);
        height: 4px; border-radius: 4px; background: var(--bg3); overflow: hidden;
      }
      .op__fill {
        display: block; height: 100%; width: 100%; background: var(--tone); border-radius: inherit;
        transform-origin: var(--start) center; transform: scaleX(var(--p));
        transition: transform 0.8s var(--ease-out);
        animation: op-grow 1s var(--ease-out) 0.15s both;
      }
      @keyframes op-grow { from { transform: scaleX(0); } }
      .op__steps { position: relative; list-style: none; margin: 0; padding: 0; display: flex; justify-content: space-between; }
      .op__step { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 0 0 auto; width: var(--dot); }
      .op__dot {
        width: var(--dot); height: var(--dot); display: grid; place-items: center; border-radius: 50%;
        background: var(--bg2); border: 2px solid var(--brd2); color: #fff;
        transition: background var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out);
        transition-delay: calc(var(--i) * 140ms + 150ms);
      }
      .is-done .op__dot { background: var(--tone); border-color: var(--tone); animation: op-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; animation-delay: calc(var(--i) * 140ms + 150ms); }
      .is-current .op__dot { box-shadow: 0 0 0 0 color-mix(in srgb, var(--tone) 45%, transparent); animation: op-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both, op-pulse 2s ease-out 1s infinite; }
      @keyframes op-pop { from { transform: scale(0.4); } }
      @keyframes op-pulse { 70% { box-shadow: 0 0 0 8px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
      .op__label { font-size: 10.5px; font-weight: 600; color: var(--txt3); white-space: nowrap; }
      .is-done .op__label { color: var(--txt); }
      @media (prefers-reduced-motion: reduce) { .op__fill, .op__dot { animation: none !important; transition: none; } }
    `,
  ],
})
export class OrderProgressComponent {
  readonly status = input.required<OrderStatus>();
  /** For cancelled orders: the last step reached before cancelling. */
  readonly lastStep = input<OrderStatus | null>(null);
  readonly compact = input(false);

  protected readonly steps = ORDER_FLOW;
  protected readonly view = ORDER_STATUS_VIEW;

  protected readonly cancelled = computed(() => this.status() === 'cancelled');
  protected readonly reached = computed(() =>
    Math.max(0, ORDER_FLOW.indexOf(this.cancelled() ? (this.lastStep() ?? 'pending') : this.status())),
  );
  protected readonly fill = computed(() => this.reached() / (ORDER_FLOW.length - 1));
}
