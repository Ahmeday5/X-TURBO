import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CarModel } from '../../models/car.model';

/**
 * A model's car photo in a wide box (`object-fit: cover` — car photos are
 * landscape), or a grey car icon when there's no photo or it fails to load.
 *
 *   <app-car-model-image [model]="m" />                         ← 64×40
 *   <app-car-model-image [model]="m" [width]="96" [height]="60" />
 */
@Component({
  selector: 'app-car-model-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (url(); as photo) {
      <img class="cmi cmi--img" [src]="photo" [alt]="'صورة ' + model().name" loading="lazy" decoding="async"
        [style.width.px]="width()" [style.height.px]="height()" (error)="broken.set(photo)" />
    } @else {
      <span class="cmi cmi--empty" [style.width.px]="width()" [style.height.px]="height()"
        role="img" [attr.aria-label]="'بدون صورة — ' + model().name">
        <app-icon name="car" [size]="Math.round(height() * 0.5)" />
      </span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; flex-shrink: 0; vertical-align: middle; }
      .cmi { flex-shrink: 0; border-radius: 8px; }
      .cmi--img { object-fit: cover; border: 1px solid var(--brd); background: var(--bg3); }
      .cmi--empty { display: grid; place-items: center; background: var(--bg3); color: var(--txt3); }
    `,
  ],
})
export class CarModelImageComponent {
  readonly model = input.required<Pick<CarModel, 'name' | 'imageUrl'>>();
  readonly width = input(64);
  readonly height = input(40);

  protected readonly Math = Math;

  /** URL that failed to load → the icon instead. A new URL (new upload) is tried again by itself. */
  protected readonly broken = signal<string | null>(null);

  protected readonly url = computed<string | null>(() => {
    const src = this.model().imageUrl;
    return src && src !== this.broken() ? src : null;
  });
}
