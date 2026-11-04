import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { IconComponent, IconName } from '../../../shared/components/icon/icon.component';
import { ParticleFieldComponent } from '../../../shared/components/particle-field/particle-field.component';
import { PointerParallaxDirective } from '../../../shared/directives/pointer-parallax.directive';
import { TurbineComponent } from './turbine/turbine.component';

interface ModuleChip {
  icon: IconName;
  label: string;
}

/** Platform modules advertised in the marquee — keep in sync with the product. */
const MODULES: readonly ModuleChip[] = [
  { icon: 'box', label: 'المنتجات' },
  { icon: 'tag', label: 'الفئات' },
  { icon: 'cart', label: 'الطلبات' },
  { icon: 'warehouse', label: 'المخازن' },
  { icon: 'store', label: 'نقاط البيع' },
  { icon: 'layers', label: 'أرصدة المخزون' },
  { icon: 'truck', label: 'الشحن' },
  { icon: 'users', label: 'العملاء' },
  { icon: 'calculator', label: 'الحسابات' },
  { icon: 'receipt', label: 'الفواتير' },
  { icon: 'file', label: 'المشتريات' },
  { icon: 'shield', label: 'الصلاحيات' },
];

/** Words cycled in the hero line; the first is repeated last for a seamless loop. */
const ROTATING_WORDS = ['المخزون', 'المخازن', 'نقاط البيع', 'الحسابات', 'الطلبات'] as const;

/**
 * Brand panel shown beside the login form on large screens. Entirely
 * decorative (aria-hidden) — no data, no inputs; motion is CSS-driven
 * except for the particle canvas.
 */
@Component({
  selector: 'app-auth-showcase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandLogoComponent, IconComponent, ParticleFieldComponent, PointerParallaxDirective, TurbineComponent],
  templateUrl: './auth-showcase.component.html',
  styleUrl: './auth-showcase.component.scss',
})
export class AuthShowcaseComponent {
  private readonly half = Math.ceil(MODULES.length / 2);

  // Each marquee track renders its list twice so a -50% translate loops seamlessly.
  protected readonly rowA = [...MODULES.slice(0, this.half), ...MODULES.slice(0, this.half)];
  protected readonly rowB = [...MODULES.slice(this.half), ...MODULES.slice(this.half)];

  protected readonly words = [...ROTATING_WORDS, ROTATING_WORDS[0]];
  protected readonly bars = [62, 88, 46, 74, 96, 58, 80];
}
