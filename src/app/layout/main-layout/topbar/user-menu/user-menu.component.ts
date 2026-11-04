import { ChangeDetectionStrategy, Component, computed, HostListener, inject, output, signal } from '@angular/core';
import { roleLabel } from '../../../../core/auth/roles';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';

/** Avatar button + account popover (identity, theme, sign-out). */
@Component({
  selector: 'app-user-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ClickOutsideDirective],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
})
export class UserMenuComponent {
  protected readonly user = inject(AuthService).currentUser;
  protected readonly roleName = computed(() => roleLabel(this.user()?.role));
  protected readonly theme = inject(ThemeService);

  /** Sign-out needs confirmation — the topbar owns that flow. */
  readonly signOut = output<void>();

  protected readonly open = signal(false);

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected requestSignOut(): void {
    this.close();
    this.signOut.emit();
  }
}
