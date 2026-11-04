import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { environment } from '../../../../environments/environment';

/**
 * Which logo artwork to render:
 *   - `auto`    → follows the active theme
 *   - `on-dark` → light text, for dark surfaces regardless of theme
 *   - `on-light`→ dark text, for light surfaces regardless of theme
 */
export type BrandLogoTone = 'auto' | 'on-dark' | 'on-light';

const LOGO_ON_DARK = 'assets/img/logo-dark.png';
const LOGO_ON_LIGHT = 'assets/img/logo-light.png';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img [src]="src()" [alt]="alt" [style.height.px]="height()" draggable="false" />`,
  styles: [
    `
      :host { display: inline-flex; line-height: 0; }
      img { display: block; width: auto; user-select: none; }
    `,
  ],
})
export class BrandLogoComponent {
  private readonly theme = inject(ThemeService);

  readonly tone = input<BrandLogoTone>('auto');
  readonly height = input<number>(40);

  protected readonly alt = environment.appName;

  protected readonly src = computed(() => {
    const tone = this.tone();
    const onDark = tone === 'on-dark' || (tone === 'auto' && this.theme.isDark());
    return onDark ? LOGO_ON_DARK : LOGO_ON_LIGHT;
  });
}
