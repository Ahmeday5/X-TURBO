import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RowAction } from '../../models/row-action.model';
import { IconComponent } from '../icon/icon.component';

const MENU_WIDTH = 220;
const GAP = 6;

/**
 * Row actions: the primary step as a labelled quick button (optional) plus a
 * "⋯" menu with every action. The menu is `position: fixed` so table
 * scroll containers can't clip it; it closes on outside click, Escape,
 * scroll and resize, and supports ↑/↓ / Enter.
 *
 *   <app-row-menu [actions]="actionsOf(row)" [quick]="true" (run)="act(row, $event)" />
 */
@Component({
  selector: 'app-row-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (actions().length) {
      @if (quick() && primary(); as p) {
        <button type="button" class="rm__quick" [class.is-danger]="p.tone === 'danger'" (click)="choose(p)" [title]="p.label">
          <app-icon [name]="p.icon" [size]="14" /> <span>{{ p.label }}</span>
        </button>
      }
      <button #trigger type="button" class="ui-icon-btn rm__trigger" [class.is-open]="open()" aria-haspopup="menu"
        [attr.aria-expanded]="open()" [attr.aria-label]="label()" [title]="label()" (click)="toggle()">
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
          <circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" />
        </svg>
      </button>
      @if (open()) {
        <div class="rm__menu" role="menu" [style.top.px]="pos().top" [style.left.px]="pos().left"
          [style.width.px]="menuWidth" (keydown)="onKeydown($event)">
          @for (a of actions(); track a.key; let i = $index) {
            @if (a.separated && i > 0) {<div class="rm__sep" role="separator"></div>}
            <button type="button" role="menuitem" class="rm__item" [class.is-primary]="a.tone === 'primary'"
              [class.is-danger]="a.tone === 'danger'" [class.is-active]="i === active()" (mouseenter)="active.set(i)"
              (click)="choose(a)">
              <app-icon [name]="a.icon" [size]="15" /> {{ a.label }}
            </button>
          }
        </div>
      }
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 4px; }
    .rm__quick {
      all: unset; display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px;
      border-radius: 9px; font-size: 11.5px; font-weight: 600; white-space: nowrap; cursor: pointer;
      color: var(--primary); background: var(--primary-soft); transition: background var(--dur-fast), transform var(--dur-fast);
    }
    .rm__quick:hover { background: color-mix(in srgb, var(--primary) 18%, transparent); }
    .rm__quick:active { transform: scale(0.97); }
    .rm__quick:focus-visible { box-shadow: var(--focus-ring); }
    .rm__quick.is-danger { color: var(--re); background: var(--re-l); }
    @media (max-width: 900px) { .rm__quick span { display: none; } }
    .rm__trigger.is-open { background: var(--bg3); color: var(--txt); }
    .rm__menu {
      position: fixed; z-index: var(--z-modal); padding: 6px; border-radius: 12px; background: var(--bg-elevated, var(--bg2));
      border: 1px solid var(--brd2); box-shadow: var(--shadow-lg); animation: rm-in 0.14s var(--ease-out) both;
    }
    @keyframes rm-in { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }
    .rm__item {
      all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 9px; width: 100%;
      padding: 8px 10px; border-radius: 8px; font-size: 12.5px; color: var(--txt); cursor: pointer;
    }
    .rm__item app-icon { color: var(--txt3); }
    .rm__item.is-active { background: var(--bg3); }
    .rm__item.is-primary { font-weight: 600; }
    .rm__item.is-primary app-icon { color: var(--primary); }
    .rm__item.is-danger, .rm__item.is-danger app-icon { color: var(--re); }
    .rm__item.is-danger.is-active { background: var(--re-l); }
    .rm__sep { height: 1px; margin: 4px 6px; background: var(--brd); }
  `,
})
export class RowMenuComponent<K extends string = string> {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly actions = input.required<readonly RowAction<K>[]>();
  /** Also show the primary action as a labelled button next to the menu. */
  readonly quick = input(false);
  readonly label = input('إجراءات');
  readonly run = output<K>();

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly pos = signal({ top: 0, left: 0 });
  protected readonly menuWidth = MENU_WIDTH;
  protected readonly primary = computed(() => this.actions().find((a) => a.tone === 'primary') ?? null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.listen(false));
  }

  protected toggle(): void {
    if (this.open()) return this.close();
    this.place();
    this.active.set(0);
    this.open.set(true);
    this.listen(true);
    queueMicrotask(() => this.focusActive());
  }

  protected choose(action: RowAction<K>): void {
    this.close();
    this.run.emit(action.key);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const n = this.actions().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.update((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + n) % n);
      this.focusActive();
    } else if (event.key === 'Tab') {
      this.close();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.open()) return;
    this.close();
    this.trigger()?.nativeElement.focus();
  }

  /** Any scroll (page or a table's own scroller — hence capture) or resize would detach the fixed menu. */
  private readonly onViewportChange = (): void => this.close();

  private listen(on: boolean): void {
    const method = on ? 'addEventListener' : 'removeEventListener';
    window[method]('scroll', this.onViewportChange, true);
    window[method]('resize', this.onViewportChange);
  }

  private close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.listen(false);
  }

  /** Below the trigger, aligned to its inline-end; flips up / inward near the viewport edges. */
  private place(): void {
    const rect = this.trigger()?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const estimatedHeight = this.actions().length * 36 + 16;
    let left = rtl ? rect.left : rect.right - MENU_WIDTH;
    left = Math.min(Math.max(8, left), window.innerWidth - MENU_WIDTH - 8);
    const below = rect.bottom + GAP;
    const top = below + estimatedHeight > window.innerHeight ? Math.max(8, rect.top - GAP - estimatedHeight) : below;
    this.pos.set({ top, left });
  }

  private focusActive(): void {
    const items = this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.rm__item');
    // preventScroll: a focus-scroll would fire the scroll listener and close the menu.
    items[this.active()]?.focus({ preventScroll: true });
  }
}
