import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PASSWORD_RULES } from '../../models/user.model';

const LEVELS = [
  { label: 'ضعيفة جدًا', color: 'var(--re)' },
  { label: 'ضعيفة', color: 'var(--re)' },
  { label: 'متوسطة', color: 'var(--am)' },
  { label: 'جيدة', color: 'var(--am)' },
  { label: 'قوية', color: 'var(--gr)' },
  { label: 'قوية جدًا', color: 'var(--gr)' },
];

/** Live strength meter + rule checklist for a password value. */
@Component({
  selector: 'app-password-strength',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="pws-meter" [style.--c]="level().color" aria-hidden="true">
      @for (s of segments; track s) {
        <span [class.is-on]="score() > s"></span>
      }
    </div>
    <p class="pws-label" aria-live="polite">
      قوة كلمة المرور: <strong [style.color]="level().color">{{ value() ? level().label : '—' }}</strong>
    </p>
    <ul class="pws-rules">
      @for (r of checks(); track r.id) {
        <li [class.is-ok]="r.ok">
          <app-icon [name]="r.ok ? 'check' : 'x'" [size]="12" /> {{ r.label }}
        </li>
      }
    </ul>
  `,
  styles: [
    `
      :host { display: block; margin-top: 8px; }
      .pws-meter { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
      .pws-meter span { height: 5px; border-radius: 99px; background: var(--bg3); transition: background var(--dur); }
      .pws-meter span.is-on { background: var(--c); }
      .pws-label { margin: 6px 0 4px; font-size: 11.5px; color: var(--txt3); }
      .pws-rules {
        list-style: none; margin: 0; padding: 0;
        display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 3px 12px;
      }
      .pws-rules li { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--txt3); }
      .pws-rules li.is-ok { color: var(--gr); }
    `,
  ],
})
export class PasswordStrengthComponent {
  readonly value = input<string>('');

  protected readonly segments = [0, 1, 2, 3, 4];
  protected readonly checks = computed(() =>
    PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(this.value() ?? '') })),
  );
  protected readonly score = computed(() => {
    if (!this.value()) return 0;
    return this.checks().filter((c) => c.ok).length;
  });
  protected readonly level = computed(() => {
    const v = this.value() ?? '';
    const s = this.score();
    return LEVELS[s === 5 && v.length >= 12 ? 5 : s];
  });
}
