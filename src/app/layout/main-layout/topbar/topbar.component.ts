import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LayoutService } from '../../../core/services/layout.service';
import { DialogService } from '../../../core/services/dialog.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { NavSearchComponent } from './nav-search/nav-search.component';
import { UserMenuComponent } from './user-menu/user-menu.component';

@Component({
  selector: 'app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BrandLogoComponent, NavSearchComponent, ThemeToggleComponent, UserMenuComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  // Lets the brand column track the sidebar's collapsed width.
  host: { '[class.is-rail]': 'layout.collapsed()' },
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  protected readonly layout = inject(LayoutService);
  private readonly dialog = inject(DialogService);

  logout(): void {
    this.dialog
      .confirm({
        title: 'تسجيل الخروج',
        message: 'هل تريد تسجيل الخروج من النظام؟',
        confirmText: 'تسجيل الخروج',
        type: 'warning',
      })
      .then((confirmed) => {
        if (confirmed) {
          this.authService.logout();
          this.layout.closeMobile();
        }
      });
  }
}
