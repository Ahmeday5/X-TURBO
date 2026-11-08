import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationService } from '../../../core/services/navigation.service';
import { IconComponent, IconName } from '../icon/icon.component';

/**
 * Page title block with a breadcrumb derived from the nav tree. Pass the
 * page's `navId` (bound from route data) and the rest fills itself in;
 * `title` / `icon` override when a page needs a different heading.
 *
 *   <app-page-header [navId]="navId()" subtitle="…">
 *     <button class="ui-btn ui-btn--primary">إضافة</button>
 *   </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    @if (page(); as p) {
      <nav class="ph-crumbs" aria-label="مسار التنقل">
        <a routerLink="/dashboard">الرئيسية</a>
        <app-icon class="ph-sep" name="chevron-left" [size]="12" />
        <span>{{ p.section }}</span>
        @if (p.group) {
          <app-icon class="ph-sep" name="chevron-left" [size]="12" />
          <span>{{ p.group.label }}</span>
        }
        <app-icon class="ph-sep" name="chevron-left" [size]="12" />
        <span class="ph-current" aria-current="page">{{ heading() }}</span>
      </nav>
    }

    <header class="ph">
      <span class="ph-icon"><app-icon [name]="glyph()" [size]="22" /></span>
      <div class="ph-text">
        <h1 class="ph-title">{{ heading() }}</h1>
        @if (subtitle() || page()?.description) {
          <p class="ph-sub">{{ subtitle() || page()?.description }}</p>
        }
      </div>
      <div class="ph-actions"><ng-content /></div>
    </header>
  `,
  styles: [
    `
      :host { display: block; margin-bottom: 18px; animation: ph-in 0.5s var(--ease-out) backwards; }

      .ph-crumbs {
        display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
        margin-bottom: 12px; font-size: 12px; color: var(--txt3);
      }
      .ph-crumbs a { color: inherit; text-decoration: none; transition: color var(--dur-fast); }
      .ph-crumbs a:hover { color: var(--primary); }
      .ph-sep { opacity: 0.6; }
      .ph-current { color: var(--txt); font-weight: 600; }

      .ph { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
      .ph-icon {
        flex-shrink: 0; width: 48px; height: 48px; display: grid; place-items: center;
        border-radius: 15px; color: #fff; background: var(--brand-gradient);
        box-shadow: 0 12px 26px -12px rgba(var(--primary-rgb), 0.85);
        animation: ph-icon-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s backwards;
      }
      .ph-text { flex: 1 1 220px; min-width: 0; }
      .ph-title { margin: 0; font-size: 22px; font-weight: 700; color: var(--txt); }
      .ph-sub { margin: 3px 0 0; font-size: 13px; color: var(--txt3); }
      .ph-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .ph-actions:empty { display: none; }

      @media (max-width: 575.98px) {
        .ph-title { font-size: 19px; }
        .ph-actions { width: 100%; }
        .ph-actions ::ng-deep > * { flex: 1; }
      }

      @keyframes ph-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      @keyframes ph-icon-in { from { opacity: 0; transform: scale(0.6) rotate(-12deg); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) { :host, .ph-icon { animation: none; } }
    `,
  ],
})
export class PageHeaderComponent {
  private readonly nav = inject(NavigationService);

  readonly navId = input<string>('');
  readonly title = input('');
  readonly subtitle = input('');
  readonly icon = input<IconName | null>(null);

  protected readonly page = computed(() => (this.navId() ? this.nav.leaf(this.navId()) : undefined));
  protected readonly heading = computed(() => this.title() || this.page()?.label || '');
  protected readonly glyph = computed<IconName>(() => this.icon() ?? this.page()?.icon ?? 'grid');
}
