import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';
import { PointerParallaxDirective } from '../../shared/directives/pointer-parallax.directive';
import { environment } from '../../../environments/environment';
import { AuthShowcaseComponent } from './auth-showcase/auth-showcase.component';

/**
 * Shell for /auth/login: animated brand showcase (≥ lg) beside a themed
 * panel that hosts the routed form, which renders only its own content.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    AuthShowcaseComponent,
    BrandLogoComponent,
    IconComponent,
    ThemeToggleComponent,
    PointerParallaxDirective,
  ],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  protected readonly appName = environment.appName;
  protected readonly appVersion = environment.appVersion;
  protected readonly year = new Date().getFullYear();
}
