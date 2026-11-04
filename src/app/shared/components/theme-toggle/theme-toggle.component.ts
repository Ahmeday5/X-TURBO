import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

let nextId = 0;

/** Animated sun ⇄ moon button; the theme reveal expands from its centre. */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  /** SVG ids are document-global — keep each instance's mask unique. */
  protected readonly maskId = `tt-moon-mask-${nextId++}`;

  protected onToggle(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.theme.toggle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }
}
