import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { initialsOf } from '../../utils/initials.util';

/** Hues tuned to read on both themes; picked by name so a person keeps their colour. */
const HUES = [356, 24, 42, 145, 172, 200, 228, 262, 300, 330];

/** Initials avatar with a stable per-name tint. */
@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ initials() }}`,
  host: {
    'aria-hidden': 'true',
    '[style.--av-h]': 'hue()',
    '[style.--av-size.px]': 'size()',
  },
  styles: [
    `
      :host {
        flex-shrink: 0;
        width: var(--av-size); height: var(--av-size);
        display: inline-grid; place-items: center;
        border-radius: 50%;
        font-size: calc(var(--av-size) * 0.36); font-weight: 700;
        color: hsl(var(--av-h) 62% 38%);
        background: hsl(var(--av-h) 75% 92%);
        transition: transform var(--dur) var(--ease-out);
      }
      :host-context([data-theme='dark']) { color: hsl(var(--av-h) 80% 78%); background: hsl(var(--av-h) 35% 22%); }
    `,
  ],
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly size = input(34);

  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly hue = computed(() => {
    let h = 0;
    for (const ch of this.name()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return HUES[h % HUES.length];
  });
}
