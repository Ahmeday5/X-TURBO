import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { highlightSegments } from '../../utils/arabic-search.util';

/**
 * Renders `text` with every query match wrapped in `<mark>` (Arabic-aware,
 * see `highlightSegments`). Safe by construction — no innerHTML.
 *
 *   <app-highlight [text]="item.label" [query]="term()" />
 */
@Component({
  selector: 'app-highlight',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Kept on one line on purpose: any whitespace here would render between segments.
  template: `@for (seg of segments(); track $index) {@if (seg.hit) {<mark class="hl">{{ seg.text }}</mark>} @else {<ng-container>{{ seg.text }}</ng-container>}}`,
  styles: [
    `
      :host { display: contents; }
      .hl {
        padding: 0;
        border-radius: 3px;
        background: rgba(var(--primary-rgb), 0.16);
        color: var(--primary-strong);
        box-shadow: 0 0 0 1px rgba(var(--primary-rgb), 0.16);
      }
    `,
  ],
})
export class HighlightComponent {
  readonly text = input.required<string>();
  readonly query = input<string>('');

  protected readonly segments = computed(() => highlightSegments(this.text(), this.query()));
}
