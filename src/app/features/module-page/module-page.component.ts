import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationService } from '../../core/services/navigation.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * Shared shell for every ERP page that is routed and permission-guarded but
 * whose screen isn't built yet. Everything it shows (title, icon, breadcrumb,
 * related pages) comes from the nav tree via the route's `navId`, so adding
 * a page to NAV_SECTIONS is enough to get a complete, linked page here.
 *
 * When a real screen lands, register it in BUILT_PAGES in app.routes.ts.
 */
@Component({
  selector: 'app-module-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, PageHeaderComponent],
  templateUrl: './module-page.component.html',
  styleUrl: './module-page.component.scss',
})
export class ModulePageComponent {
  private readonly nav = inject(NavigationService);

  /** Bound from route `data`. */
  readonly navId = input.required<string>();

  protected readonly page = computed(() => this.nav.leaf(this.navId()));
  protected readonly related = computed(() => this.nav.siblings(this.navId()));
}
