import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const STAR_PATH = 'M10 1.8l2.5 5.1 5.6.8-4 3.9.9 5.6L10 14.6l-5 2.6.9-5.6-4-3.9 5.6-.8L10 1.8z';

/**
 * 0–5 star rating, fractional (4.3 fills the 5th star 30%). Read-only.
 * The accessible label reads the value ("التقييم 4.3 من 5").
 *
 *   <app-rating-stars [value]="item.averageRating" [size]="14" />
 */
@Component({
  selector: 'app-rating-stars',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="rs" role="img" [attr.aria-label]="'التقييم ' + label() + ' من 5'" [style.--rs-size.px]="size()">
      @for (fill of fills(); track $index) {
        <svg class="rs__star" viewBox="0 0 20 20" aria-hidden="true">
          <path class="rs__bg" [attr.d]="path" />
          <path class="rs__fg" [attr.d]="path" [style.clip-path]="'inset(0 ' + (100 - fill) + '% 0 0)'" />
        </svg>
      }
    </span>
  `,
  styles: [
    `
      :host { display: inline-flex; vertical-align: middle; }
      .rs { display: inline-flex; gap: 1px; direction: ltr; }
      .rs__star { width: var(--rs-size); height: var(--rs-size); }
      .rs__bg { fill: var(--brd2); }
      .rs__fg { fill: #f5a524; }
    `,
  ],
})
export class RatingStarsComponent {
  readonly value = input.required<number>();
  readonly size = input(14);

  protected readonly path = STAR_PATH;
  /** Fill % of each of the 5 stars. */
  protected readonly fills = computed(() => {
    const v = Math.max(0, Math.min(5, this.value() || 0));
    return [0, 1, 2, 3, 4].map((i) => Math.round(Math.max(0, Math.min(1, v - i)) * 100));
  });
  protected readonly label = computed(() => (Math.round((this.value() || 0) * 10) / 10).toString());
}
