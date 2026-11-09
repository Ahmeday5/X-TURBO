import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Role } from '../../../../core/auth/roles';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { formatInteger } from '../../../../shared/utils/format.util';
import { PERMISSION_GROUPS, ROLE_DEFAULT_PERMISSIONS, ROLE_VIEW, USER_ROLES, UserStats } from '../../models/user.model';

/** Role cards (default permissions + user count) and a permission × role matrix. */
@Component({
  selector: 'app-roles-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="ro-cards">
      @for (r of cards(); track r.role; let i = $index) {
        <article class="ro-card" [style.--tone]="r.view.color" [style.--i]="i">
          <header>
            <span class="ro-card__icon"><app-icon [name]="r.view.icon" [size]="20" /></span>
            <div>
              <h3>{{ r.view.label }}</h3>
              <p>{{ r.view.hint }}</p>
            </div>
          </header>
          <dl class="ro-card__stats">
            <div><dt>المستخدمون</dt><dd>{{ r.users === null ? '—' : int(r.users) }}</dd></div>
            <div><dt>الصلاحيات</dt><dd>{{ r.permissions.length }} / {{ total }}</dd></div>
          </dl>
          <ul class="ro-card__perms">
            @for (p of r.permissions; track p.key) {
              <li class="ui-chip" [style.--chip]="r.view.color">{{ p.label }}</li>
            }
          </ul>
          <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm ro-card__btn" (click)="roleSelected.emit(r.role)">
            <app-icon name="users" [size]="14" /> عرض مستخدمي الدور
          </button>
        </article>
      }
    </div>

    <section class="panel ro-matrix">
      <header class="panel__head">
        <div>
          <h3 class="panel__title">مصفوفة الصلاحيات الافتراضية</h3>
          <p class="panel__sub">ما يحصل عليه كل دور عند إنشاء مستخدم جديد — يمكن تخصيص صلاحيات كل مستخدم على حدة.</p>
        </div>
      </header>
      <div class="ro-scroll">
        <table>
          <thead>
            <tr>
              <th>الصلاحية</th>
              @for (r of roles; track r) {<th class="ro-c">{{ view[r].label }}</th>}
            </tr>
          </thead>
          <tbody>
            @for (g of groups; track g.section) {
              <tr class="ro-group"><td [attr.colspan]="roles.length + 1">{{ g.section }}</td></tr>
              @for (p of g.permissions; track p.key) {
                <tr>
                  <td>
                    <span class="ro-perm"><app-icon [name]="p.icon" [size]="14" /> {{ p.label }}</span>
                  </td>
                  @for (r of roles; track r) {
                    <td class="ro-c">
                      @if (has(r, p.key)) {
                        <span class="ro-yes" [style.--tone]="view[r].color" aria-label="مسموح"><app-icon name="check" [size]="13" /></span>
                      } @else {
                        <span class="ro-no" aria-label="غير مسموح">—</span>
                      }
                    </td>
                  }
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; gap: 18px; }
      .ro-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
      .ro-card {
        --tone: var(--primary);
        display: flex; flex-direction: column; gap: 14px; padding: 16px;
        background: var(--bg2); border: 1px solid var(--brd); border-radius: var(--rx); box-shadow: var(--shadow);
        border-top: 3px solid var(--tone);
        animation: reveal-up 0.5s var(--ease-out) both; animation-delay: calc(var(--i) * 60ms);
      }
      .ro-card header { display: flex; gap: 12px; align-items: flex-start; }
      .ro-card h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--txt); }
      .ro-card p { margin: 3px 0 0; font-size: 11.5px; line-height: 1.6; color: var(--txt3); }
      .ro-card__icon {
        flex-shrink: 0; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px;
        color: var(--tone); background: color-mix(in srgb, var(--tone) 12%, transparent);
      }
      .ro-card__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0; }
      .ro-card__stats div { padding: 8px 10px; border-radius: 10px; background: var(--bg3); }
      .ro-card__stats dt { font-size: 11px; font-weight: 500; color: var(--txt3); }
      .ro-card__stats dd { margin: 2px 0 0; font-size: 17px; font-weight: 700; color: var(--txt); font-variant-numeric: tabular-nums; }
      .ro-card__perms { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; flex: 1; align-content: flex-start; }
      .ro-card__btn { align-self: flex-start; }
      .ro-scroll { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      th { padding: 8px 10px; text-align: start; font-size: 11.5px; font-weight: 600; color: var(--txt3); border-bottom: 1px solid var(--brd); white-space: nowrap; }
      td { padding: 7px 10px; border-bottom: 1px solid var(--brd); color: var(--txt); }
      .ro-c { text-align: center; }
      .ro-group td { padding-top: 14px; font-size: 11.5px; font-weight: 700; color: var(--txt2); background: var(--bg3); }
      .ro-perm { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
      .ro-yes {
        display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%;
        color: #fff; background: var(--tone);
      }
      .ro-no { color: var(--txt3); }
      @media (prefers-reduced-motion: reduce) { .ro-card { animation: none; } }
    `,
  ],
})
export class RolesOverviewComponent {
  readonly stats = input<UserStats | null>(null);
  readonly roleSelected = output<Role>();

  protected readonly roles = USER_ROLES;
  protected readonly view = ROLE_VIEW;
  protected readonly groups = PERMISSION_GROUPS;
  protected readonly total = PERMISSION_GROUPS.reduce((n, g) => n + g.permissions.length, 0);
  protected readonly int = formatInteger;

  protected readonly cards = computed(() => {
    const s = this.stats();
    return USER_ROLES.map((role) => {
      const set = new Set<string>(ROLE_DEFAULT_PERMISSIONS[role]);
      return {
        role,
        view: ROLE_VIEW[role],
        users: s ? (s.byRole[role] ?? 0) : null,
        permissions: PERMISSION_GROUPS.flatMap((g) => g.permissions).filter((p) => set.has(p.key)),
      };
    });
  });

  protected has(role: Role, key: string): boolean {
    return (ROLE_DEFAULT_PERMISSIONS[role] as readonly string[]).includes(key);
  }
}
