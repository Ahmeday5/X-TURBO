import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '../../../core/services/layout.service';
import { NavigationService } from '../../../core/services/navigation.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  protected readonly layout = inject(LayoutService);
  private readonly nav = inject(NavigationService);

  protected readonly appVersion = environment.appVersion;

  /** Visible sections with a running item index, used to stagger the entrance. */
  protected readonly sections = computed(() => {
    let order = 0;
    return this.nav.sections().map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, order: order++ })),
    }));
  });
}
