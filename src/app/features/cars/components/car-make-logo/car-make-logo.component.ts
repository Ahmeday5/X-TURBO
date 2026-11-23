import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CarMake, carMakeInitial } from '../../models/car.model';

/**
 * A make's logo in a square box (`object-fit: contain` — logos are never
 * cropped), or a circle with the make's first letter when there's no logo or
 * it fails to load.
 *
 *   <app-car-make-logo [make]="m" />            ← 40×40
 *   <app-car-make-logo [make]="m" [size]="56" />
 */
@Component({
  selector: 'app-car-make-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url(); as logo) {
      <img class="cml cml--img" [src]="logo" [alt]="'لوجو ' + make().name" loading="lazy" decoding="async"
        [style.width.px]="size()" [style.height.px]="size()" (error)="broken.set(logo)" />
    } @else {
      <span class="cml cml--initial" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.42"
        role="img" [attr.aria-label]="'بدون لوجو — ' + make().name">{{ initial() }}</span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; flex-shrink: 0; }
      .cml { flex-shrink: 0; }
      .cml--img {
        object-fit: contain; padding: 4px; border: 1px solid var(--brd); border-radius: 10px; background: #fff;
      }
      .cml--initial {
        display: grid; place-items: center; border-radius: 50%;
        background: var(--primary-soft); color: var(--primary-strong); font-weight: 800; line-height: 1;
      }
    `,
  ],
})
export class CarMakeLogoComponent {
  readonly make = input.required<Pick<CarMake, 'name' | 'nameEn' | 'logoUrl'>>();
  /** Box size in px (square). */
  readonly size = input(40);
  /** Overrides `make.logoUrl` — e.g. a picked file's preview in the form. `undefined` = use the make's. */
  readonly src = input<string | null | undefined>(undefined);

  /** URL that failed to load → the initial instead. A new URL (new upload) is tried again by itself. */
  protected readonly broken = signal<string | null>(null);

  protected readonly url = computed<string | null>(() => {
    const override = this.src();
    const src = override === undefined ? this.make().logoUrl : override;
    return src && src !== this.broken() ? src : null;
  });
  protected readonly initial = computed(() => carMakeInitial(this.make()));
}
