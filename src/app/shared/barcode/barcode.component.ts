import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { barcodeGeometry } from './code128';

/**
 * Code 128 barcode as inline SVG. Fills its container's width; set the height
 * with `[height]` (px) or CSS. Renders nothing for values Code 128 can't hold.
 *
 *   <app-barcode [value]="item.barcode" [showText]="true" />
 */
@Component({
  selector: 'app-barcode',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg [attr.viewBox]="'0 0 ' + g.modules + ' 40'" preserveAspectRatio="none" shape-rendering="crispEdges"
        [style.height.px]="height()" role="img" [attr.aria-label]="'باركود ' + value()">
        @for (b of g.bars; track $index) {
          <rect [attr.x]="b.x" y="0" [attr.width]="b.width" height="40" />
        }
      </svg>
      @if (showText()) {<span class="bc__text">{{ value() }}</span>}
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; }
    svg { display: block; width: 100%; fill: #000; background: #fff; }
    .bc__text { direction: ltr; font: 600 11px/1 ui-monospace, 'Cascadia Mono', Consolas, monospace; letter-spacing: 1px; color: var(--txt); }
  `,
})
export class BarcodeComponent {
  readonly value = input.required<string>();
  readonly height = input(48);
  readonly showText = input(false);

  protected readonly geometry = computed(() => barcodeGeometry(this.value().trim()));
}
