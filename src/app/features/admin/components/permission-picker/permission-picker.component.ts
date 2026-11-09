import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Permission } from '../../../../core/auth/permissions';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { normalizePermissions, PERMISSION_GROUPS, PermissionGroup } from '../../models/user.model';

/**
 * Permission checklist grouped by sidebar section. Stateless: the parent owns
 * `value`; `locked` keys stay checked and can't be toggled (e.g. your own
 * Users.Manage).
 */
@Component({
  selector: 'app-permission-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @for (g of groups; track g.section; let i = $index) {
      <fieldset class="pp-group" [disabled]="disabled()" [style.--i]="i">
        <legend class="pp-head">
          <span>{{ g.section }}</span>
          <small>{{ countIn(g) }} / {{ g.permissions.length }}</small>
          <button type="button" class="pp-all" [attr.aria-pressed]="countIn(g) === g.permissions.length"
            (click)="toggleGroup(g)">
            {{ countIn(g) === g.permissions.length ? 'إلغاء الكل' : 'تحديد الكل' }}
          </button>
        </legend>
        <div class="pp-list">
          @for (p of g.permissions; track p.key) {
            <label class="pp-item" [class.is-on]="selected().has(p.key)" [class.is-locked]="lockedSet().has(p.key)">
              <input type="checkbox" [checked]="selected().has(p.key)" [disabled]="disabled() || lockedSet().has(p.key)"
                (change)="toggle(p.key)" />
              <span class="pp-box"><app-icon name="check" [size]="12" /></span>
              <span class="pp-icon"><app-icon [name]="p.icon" [size]="15" /></span>
              <span class="pp-text">
                <strong>{{ p.label }}</strong>
                <small>{{ p.hint }}</small>
              </span>
              @if (lockedSet().has(p.key)) {
                <app-icon class="pp-lock" name="lock" [size]="13" />
              }
            </label>
          }
        </div>
      </fieldset>
    }
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; gap: 12px; }
      .pp-group {
        margin: 0; padding: 10px 12px 12px; min-width: 0;
        border: 1px solid var(--brd); border-radius: 13px; background: var(--bg2);
        animation: reveal-up 0.45s var(--ease-out) both; animation-delay: calc(var(--i) * 40ms);
      }
      .pp-group:disabled { opacity: 0.65; }
      .pp-head {
        float: none; width: 100%; display: flex; align-items: center; gap: 8px;
        margin: 0 0 8px; padding: 0; font-size: 12.5px; font-weight: 700; color: var(--txt);
      }
      .pp-head small { color: var(--txt3); font-weight: 600; font-variant-numeric: tabular-nums; }
      .pp-all {
        margin-inline-start: auto; border: 0; background: none; padding: 2px 4px; cursor: pointer;
        font: inherit; font-size: 11.5px; font-weight: 600; color: var(--primary);
      }
      .pp-all:disabled { cursor: default; color: var(--txt3); }
      .pp-all:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: 6px; }
      .pp-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
      .pp-item {
        position: relative; display: flex; align-items: center; gap: 10px; padding: 9px 10px;
        border: 1px solid var(--brd2); border-radius: 11px; background: var(--bg);
        cursor: pointer; transition: border-color var(--dur-fast), background var(--dur-fast);
      }
      .pp-item:hover { border-color: var(--txt3); }
      .pp-item input { position: absolute; opacity: 0; pointer-events: none; }
      .pp-item:has(input:focus-visible) { box-shadow: var(--focus-ring); }
      .pp-item.is-on { border-color: rgba(var(--primary-rgb), 0.45); background: var(--primary-soft); }
      .pp-item.is-locked { cursor: not-allowed; }
      .pp-box {
        flex-shrink: 0; width: 18px; height: 18px; display: grid; place-items: center;
        border: 1.5px solid var(--brd2); border-radius: 6px; color: transparent;
        transition: background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast);
      }
      .is-on .pp-box { background: var(--primary); border-color: var(--primary); color: #fff; }
      .pp-icon { flex-shrink: 0; color: var(--txt3); display: inline-grid; }
      .is-on .pp-icon { color: var(--primary-strong); }
      .pp-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .pp-text strong { font-size: 12.5px; font-weight: 600; color: var(--txt); }
      .pp-text small {
        font-size: 10.5px; color: var(--txt3);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .pp-lock { margin-inline-start: auto; color: var(--txt3); }
      @media (prefers-reduced-motion: reduce) { .pp-group { animation: none; } }
    `,
  ],
})
export class PermissionPickerComponent {
  readonly value = input.required<readonly Permission[]>();
  readonly locked = input<readonly Permission[]>([]);
  readonly disabled = input(false);
  readonly valueChange = output<Permission[]>();

  protected readonly groups = PERMISSION_GROUPS;
  protected readonly selected = computed(() => new Set<string>(this.value()));
  protected readonly lockedSet = computed(() => new Set<string>(this.locked()));

  protected countIn(g: PermissionGroup): number {
    const s = this.selected();
    return g.permissions.filter((p) => s.has(p.key)).length;
  }

  protected toggle(key: Permission): void {
    if (this.lockedSet().has(key)) return;
    const next = new Set(this.selected());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.emit(next);
  }

  protected toggleGroup(g: PermissionGroup): void {
    const next = new Set(this.selected());
    const all = this.countIn(g) === g.permissions.length;
    for (const p of g.permissions) {
      if (this.lockedSet().has(p.key)) continue;
      if (all) next.delete(p.key);
      else next.add(p.key);
    }
    this.emit(next);
  }

  private emit(set: Set<string>): void {
    for (const k of this.locked()) set.add(k);
    this.valueChange.emit(normalizePermissions([...set]));
  }
}
