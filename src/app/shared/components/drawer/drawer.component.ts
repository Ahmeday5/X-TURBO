import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

/**
 * Side sheet sliding in from the inline-end edge (full width on phones).
 * Closes on Esc / backdrop / ✕ by emitting `closed` — the parent owns `open`
 * (e.g. bound to a URL param so a refresh reopens it).
 *
 *   <app-drawer [open]="!!id()" label="تفاصيل الطلب" (closed)="close()">
 *     <div drawer-title>…</div>  …body…  <div drawer-footer>…</div>
 *   </app-drawer>
 */
@Component({
  selector: 'app-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (open()) {
      <div class="dr-backdrop" (click)="closed.emit()"></div>
      <aside #panel class="dr" role="dialog" aria-modal="true" [attr.aria-label]="label()" tabindex="-1"
        (keydown.escape)="closed.emit()">
        <header class="dr__head">
          <div class="dr__title"><ng-content select="[drawer-title]" /></div>
          <button type="button" class="ui-icon-btn dr__close" aria-label="إغلاق" (click)="closed.emit()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>
        <div class="dr__body"><ng-content /></div>
        <footer class="dr__foot"><ng-content select="[drawer-footer]" /></footer>
      </aside>
    }
  `,
  styles: [
    `
      :host { display: contents; }
      .dr-backdrop {
        position: fixed; inset: 0; z-index: var(--z-drawer); background: var(--overlay);
        backdrop-filter: blur(3px); animation: dr-fade 0.3s var(--ease-out) both;
      }
      .dr {
        position: fixed; inset-block: 0; inset-inline-end: 0; z-index: calc(var(--z-drawer) + 1);
        width: min(560px, 100vw); display: flex; flex-direction: column;
        background: var(--bg-elevated); box-shadow: var(--shadow-lg); outline: none;
        border-start-start-radius: var(--rx); border-end-start-radius: var(--rx);
        animation: dr-slide 0.45s var(--ease-out) both;
      }
      .dr__head {
        display: flex; align-items: flex-start; gap: 12px;
        padding: 18px 20px 14px; border-bottom: 1px solid var(--brd);
      }
      .dr__title { flex: 1; min-width: 0; }
      .dr__close { transition: transform var(--dur) var(--ease-out); }
      .dr__close:hover { transform: rotate(90deg); }
      .dr__body { flex: 1; overflow-y: auto; padding: 18px 20px; overscroll-behavior: contain; }
      .dr__foot { padding: 14px 20px; border-top: 1px solid var(--brd); display: flex; flex-wrap: wrap; gap: 8px; }
      .dr__foot:empty { display: none; }

      @media (max-width: 575.98px) {
        .dr { border-radius: 0; }
        .dr__head, .dr__body, .dr__foot { padding-inline: 16px; }
        .dr__foot ::ng-deep > * { flex: 1; }
      }

      @keyframes dr-fade { from { opacity: 0; } }
      @keyframes dr-slide { from { transform: translateX(calc(-100% * var(--dir))); opacity: 0.6; } }
      @media (prefers-reduced-motion: reduce) { .dr, .dr-backdrop { animation: none; } }
    `,
  ],
})
export class DrawerComponent {
  readonly open = input.required<boolean>();
  readonly label = input.required<string>();
  readonly closed = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    const body = inject(DOCUMENT).body;
    const injector = inject(Injector);
    inject(DestroyRef).onDestroy(() => body.classList.remove('overflow-hidden'));

    effect(() => {
      const open = this.open();
      untracked(() => {
        body.classList.toggle('overflow-hidden', open);
        if (open) afterNextRender(() => this.panel()?.nativeElement.focus(), { injector });
      });
    });
  }
}
