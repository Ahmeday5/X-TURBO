import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NavigationService } from '../../../../core/services/navigation.service';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';

/**
 * Topbar "jump to page" search over the user's visible navigation.
 * Ctrl/⌘ + K focuses it; ↑/↓ moves, Enter opens, Esc closes.
 * Implements the ARIA combobox + listbox pattern.
 */
@Component({
  selector: 'app-nav-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ClickOutsideDirective],
  templateUrl: './nav-search.component.html',
  styleUrl: './nav-search.component.scss',
})
export class NavSearchComponent {
  private readonly nav = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly term = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly results = computed(() => this.nav.search(this.term()).slice(0, 8));

  protected readonly isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

  @HostListener('document:keydown', ['$event'])
  protected onGlobalKey(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.input().nativeElement.focus();
      this.input().nativeElement.select();
    }
  }

  protected onInput(value: string): void {
    this.term.set(value);
    this.activeIndex.set(0);
    this.open.set(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        if (count) this.activeIndex.update((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.activeIndex.update((i) => (i - 1 + count) % count);
        break;
      case 'Enter': {
        const item = this.results()[this.activeIndex()];
        if (item) this.go(item.route);
        break;
      }
      case 'Escape':
        this.close();
        this.input().nativeElement.blur();
        break;
    }
  }

  protected go(route: string): void {
    this.router.navigateByUrl(route);
    this.term.set('');
    this.close();
    this.input().nativeElement.blur();
  }

  protected close(): void {
    this.open.set(false);
  }
}
