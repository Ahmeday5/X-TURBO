import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../shared/components/icon/icon.component';

/**
 * Placeholder for ERP modules that are routed and permission-guarded but not
 * built yet. `title` / `icon` arrive from route `data` via component input
 * binding. Replace the route's `loadComponent` when the real page lands.
 */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <section class="panel cs reveal">
      <span class="cs__icon"><app-icon [name]="icon()" [size]="30" /></span>
      <span class="cs__badge">قيد التطوير</span>
      <h1 class="cs__title">{{ title() }}</h1>
      <p class="cs__text">
        هذا القسم ضمن خطة تطوير النظام، ومساره وصلاحياته جاهزة بالفعل، والشاشات في الطريق.
      </p>
      <a class="btn btn-primary cs__back" routerLink="/dashboard">
        <app-icon name="chevron-left" [size]="15" /> العودة إلى لوحة التحكم
      </a>
    </section>
  `,
  styles: [
    `
      :host { display: block; max-width: 640px; margin: 6vh auto 0; }
      .cs { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 48px 32px; }
      .cs__icon {
        width: 76px; height: 76px; display: grid; place-items: center; margin-bottom: 18px;
        border-radius: 22px; color: #fff; background: var(--brand-gradient);
        box-shadow: 0 18px 40px -14px rgba(var(--primary-rgb), 0.8);
        animation: cs-float 4s ease-in-out infinite alternate;
      }
      .cs__badge {
        padding: 4px 10px; border-radius: 999px; margin-bottom: 12px;
        background: var(--primary-soft); color: var(--primary-strong);
        font-size: 10.5px; font-weight: 700;
      }
      .cs__title { margin: 0 0 8px; font-size: 24px; font-weight: 700; color: var(--txt); }
      .cs__text { margin: 0 0 22px; max-width: 420px; font-size: 13px; line-height: 1.6; color: var(--txt2); }
      .cs__back { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; font-size: 12.5px; }
      @keyframes cs-float { from { transform: translateY(-4px); } to { transform: translateY(4px); } }
      @media (prefers-reduced-motion: reduce) { .cs__icon { animation: none; } }
    `,
  ],
})
export class ComingSoonComponent {
  readonly title = input<string>('قريبًا');
  readonly icon = input<IconName>('grid');
}
