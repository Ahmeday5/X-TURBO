import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatInteger } from '../../../../shared/utils/format.util';
import { Campaign, DELIVERY_SEGMENTS } from '../../models/notification-campaign.model';

/** Stacked bar of a campaign's delivery counters, with an optional legend. */
@Component({
  selector: 'app-delivery-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="db__bar" role="img" [attr.aria-label]="summary()">
      @for (s of parts(); track s.key) {
        <span class="db__seg" [class.is-live]="s.key === 'pending'" [style.flex-grow]="s.value" [style.background]="s.color"
          [title]="s.label + ': ' + s.text"></span>
      }
    </div>
    @if (legend()) {
      <ul class="db__legend">
        @for (s of segments(); track s.key) {
          <li [class.is-zero]="!s.value">
            <span class="db__dot" [style.background]="s.color"></span>{{ s.label }} <strong>{{ s.text }}</strong>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .db__bar {
      display: flex; gap: 2px; height: 8px; border-radius: 999px; overflow: hidden; background: var(--bg3);
    }
    .db__seg { min-width: 3px; transition: flex-grow 0.4s var(--ease-out); }
    .db__seg.is-live { animation: db-pulse 1.2s ease-in-out infinite; }
    @keyframes db-pulse { 50% { opacity: 0.45; } }
    .db__legend {
      list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 6px;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); font-size: 12px; color: var(--txt2);
    }
    .db__legend li { display: flex; align-items: center; gap: 6px; }
    .db__legend li.is-zero { opacity: 0.55; }
    .db__legend strong { margin-inline-start: auto; color: var(--txt); font-variant-numeric: tabular-nums; }
    .db__dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  `,
})
export class DeliveryBarComponent {
  readonly campaign = input.required<Campaign>();
  readonly legend = input(false);

  protected readonly segments = computed(() => {
    const c = this.campaign();
    return DELIVERY_SEGMENTS.map((s) => ({ ...s, value: c[s.key], text: formatInteger(c[s.key]) }));
  });
  /** Only non-empty slices take room in the bar. */
  protected readonly parts = computed(() => this.segments().filter((s) => s.value > 0));
  protected readonly summary = computed(() =>
    this.segments()
      .filter((s) => s.value > 0)
      .map((s) => `${s.label} ${s.text}`)
      .join('، '),
  );
}
