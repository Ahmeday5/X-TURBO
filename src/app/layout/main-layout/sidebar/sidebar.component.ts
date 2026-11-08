import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IsActiveMatchOptions, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { LayoutService } from '../../../core/services/layout.service';
import { NavigationService } from '../../../core/services/navigation.service';
import { isNavGroup, NavLink } from '../../../core/models/nav.model';
import { IconComponent, IconName } from '../../../shared/components/icon/icon.component';
import { HighlightComponent } from '../../../shared/components/highlight/highlight.component';
import { HoverGlideDirective } from '../../../shared/directives/hover-glide.directive';
import { matchesAll, tokenize } from '../../../shared/utils/arabic-search.util';
import { environment } from '../../../../environments/environment';

/** A page inside an expanded group. */
interface ChildRow {
  id: string;
  label: string;
  route: string;
  icon: IconName;
  /** Position inside the group — staggers the expand animation. */
  index: number;
}

/** A top-level row: a direct link (`route`) or a collapsible group (`children`). */
interface Row {
  id: string;
  label: string;
  icon: IconName;
  route?: string;
  children?: ChildRow[];
  /** Group only: one of its pages is the current route. */
  active: boolean;
  /** Running index across the whole sidebar — staggers the entrance. */
  order: number;
}

interface SectionView {
  label: string;
  rows: Row[];
}

interface Flyout {
  row: Row;
  top: number;
}

const DESKTOP_QUERY = '(min-width: 992px)';
const FLYOUT_CLOSE_DELAY = 140;
/** Rough flyout height per page / chrome — keeps it inside the viewport. */
const FLYOUT_ROW_H = 40;
const FLYOUT_CHROME_H = 64;

const isActiveRoute = (url: string, route: string): boolean =>
  url === route || url.startsWith(`${route}/`) || url.startsWith(`${route}?`);

const toChild = (link: NavLink, index: number): ChildRow => ({
  id: link.id,
  label: link.label,
  route: link.route,
  icon: link.icon,
  index,
});

/**
 * Main navigation: searchable, accordion groups, and a collapsed desktop rail
 * whose groups open as hover/keyboard flyouts.
 *
 * Keyboard: `/` focuses the search · Enter opens the first match · Esc clears
 * · ↑/↓ Home/End move between items · Esc inside a flyout closes it.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent, HighlightComponent, HoverGlideDirective],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  protected readonly layout = inject(LayoutService);
  private readonly nav = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  protected readonly appVersion = environment.appVersion;

  /**
   * Exact path match: `/invoices` (e-commerce) and `/invoices/sales` (ERP) are
   * different pages, so the default prefix match would light up both.
   */
  protected readonly exactPath: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };

  /* ── State ── */
  protected readonly query = signal('');
  protected readonly searching = computed(() => tokenize(this.query()).length > 0);
  /** Accordion: at most one group open while not searching. */
  private readonly expanded = signal<string | null>(null);
  protected readonly flyout = signal<Flyout | null>(null);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly isDesktop = signal(this.matchDesktop());
  /** Icon-only desktop rail — groups open as flyouts instead of inline. */
  protected readonly rail = computed(() => this.layout.collapsed() && this.isDesktop());

  private flyoutTrigger: HTMLElement | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  /* ── View model ── */
  protected readonly view = computed<SectionView[]>(() => {
    const tokens = tokenize(this.query());
    const url = this.url();
    let order = 0;

    return this.nav
      .sections()
      .map((section) => {
        const rows: Row[] = [];
        for (const entry of section.items) {
          if (isNavGroup(entry)) {
            // Searching the group's own name lists all its pages.
            const groupHit = matchesAll([entry.label, ...(entry.keywords ?? [])], tokens);
            const children = entry.children.filter(
              (c) => groupHit || matchesAll([c.label, entry.label, ...(c.keywords ?? [])], tokens),
            );
            if (!children.length) continue;
            rows.push({
              id: entry.id,
              label: entry.label,
              icon: entry.icon,
              children: children.map(toChild),
              active: entry.children.some((c) => isActiveRoute(url, c.route)),
              order: order++,
            });
          } else if (matchesAll([entry.label, ...(entry.keywords ?? [])], tokens)) {
            rows.push({ id: entry.id, label: entry.label, icon: entry.icon, route: entry.route, active: false, order: order++ });
          }
        }
        return { label: section.label, rows };
      })
      .filter((section) => section.rows.length > 0);
  });

  /** Pages currently listed — announced to screen readers while searching. */
  protected readonly matchCount = computed(() =>
    this.view().reduce((sum, s) => sum + s.rows.reduce((n, r) => n + (r.children?.length ?? 1), 0), 0),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Open the group that holds the current page; close any flyout on navigation.
    effect(
      () => {
        const url = this.url();
        const owner = this.nav
          .sections()
          .flatMap((s) => s.items)
          .find((e) => isNavGroup(e) && e.children.some((c) => isActiveRoute(url, c.route)));
        untracked(() => {
          if (owner) this.expanded.set(owner.id);
          this.closeFlyout();
        });
      },
      { allowSignalWrites: true },
    );

    // Leaving rail mode (expand / resize to mobile) drops the flyout.
    effect(
      () => {
        if (!this.rail()) untracked(() => this.closeFlyout());
      },
      { allowSignalWrites: true },
    );

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia(DESKTOP_QUERY);
      const onChange = (e: MediaQueryListEvent) => this.isDesktop.set(e.matches);
      mq.addEventListener('change', onChange);
      destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
    }
    destroyRef.onDestroy(() => clearTimeout(this.closeTimer));
  }

  /* ── Groups ── */
  protected isOpen(row: Row): boolean {
    return !this.rail() && (this.searching() || this.expanded() === row.id);
  }

  protected onGroupClick(row: Row, event: MouseEvent): void {
    if (this.rail()) {
      const open = this.flyout()?.row.id === row.id;
      if (open) this.closeFlyout();
      // `detail === 0` → activated from the keyboard: move focus into the flyout.
      else this.openFlyout(row, event.currentTarget as HTMLElement, event.detail === 0);
      return;
    }
    this.expanded.update((id) => (id === row.id ? null : row.id));
  }

  /* ── Rail flyout ── */
  protected onGroupEnter(row: Row, event: MouseEvent): void {
    if (this.rail()) this.openFlyout(row, event.currentTarget as HTMLElement, false);
  }

  protected scheduleFlyoutClose(): void {
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => this.closeFlyout(), FLYOUT_CLOSE_DELAY);
  }

  protected cancelFlyoutClose(): void {
    clearTimeout(this.closeTimer);
  }

  protected closeFlyout(restoreFocus = false): void {
    clearTimeout(this.closeTimer);
    if (!this.flyout()) return;
    this.flyout.set(null);
    if (restoreFocus) this.flyoutTrigger?.focus();
    this.flyoutTrigger = null;
  }

  protected onFlyoutKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closeFlyout(true);
      return;
    }
    this.moveFocus(event, this.host.querySelector<HTMLElement>('.sb-fly'));
  }

  private openFlyout(row: Row, trigger: HTMLElement, focusFirst: boolean): void {
    clearTimeout(this.closeTimer);
    const rect = trigger.getBoundingClientRect();
    const height = FLYOUT_CHROME_H + (row.children?.length ?? 0) * FLYOUT_ROW_H;
    const top = Math.max(8, Math.min(rect.top - 6, window.innerHeight - height - 12));

    this.flyoutTrigger = trigger;
    this.flyout.set({ row, top });

    if (focusFirst) {
      afterNextRender(() => this.host.querySelector<HTMLElement>('.sb-fly [data-nav]')?.focus(), {
        injector: this.injector,
      });
    }
  }

  /* ── Search ── */
  protected onSearchInput(value: string): void {
    this.query.set(value);
    this.scroller().nativeElement.scrollTop = 0;
  }

  protected clearSearch(): void {
    this.query.set('');
    this.searchInput().nativeElement.focus();
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        if (this.query()) this.query.set('');
        else this.searchInput().nativeElement.blur();
        break;
      case 'Enter': {
        event.preventDefault();
        const first = this.firstMatch();
        if (!first) break;
        this.router.navigateByUrl(first);
        this.query.set('');
        this.layout.closeMobile();
        break;
      }
      case 'ArrowDown':
        event.preventDefault();
        this.focusables()[0]?.focus();
        break;
    }
  }

  /** From the rail's search button or the `/` shortcut. */
  protected focusSearch(): void {
    if (!this.isDesktop()) this.layout.openMobile();
    else if (this.layout.collapsed()) this.layout.toggleCollapsed();
    // Hidden with opacity (not display), so it is focusable right away.
    const input = this.searchInput().nativeElement;
    input.focus();
    input.select();
  }

  @HostListener('document:keydown', ['$event'])
  protected onGlobalKey(event: KeyboardEvent): void {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (this.isTypingTarget(event.target)) return;
    event.preventDefault();
    this.focusSearch();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointer(event: PointerEvent): void {
    if (this.flyout() && !this.host.contains(event.target as Node)) this.closeFlyout();
  }

  /* ── List keyboard navigation ── */
  protected onListKeydown(event: KeyboardEvent): void {
    this.moveFocus(event, this.scroller().nativeElement, () => this.searchInput().nativeElement.focus());
  }

  protected toggleCollapsed(): void {
    // A filtered rail would hide pages with no visible hint why.
    if (!this.layout.collapsed()) this.query.set('');
    this.layout.toggleCollapsed();
  }

  protected onNavigate(): void {
    this.layout.closeMobile();
    this.closeFlyout();
  }

  /** ↑/↓/Home/End roving focus over visible `[data-nav]` items inside `scope`. */
  private moveFocus(event: KeyboardEvent, scope: HTMLElement | null, onTopEdge?: () => void): void {
    if (!scope || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = this.focusables(scope);
    if (!items.length) return;
    event.preventDefault();

    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown': next = Math.min(current + 1, items.length - 1); break;
      case 'ArrowUp':
        if (current <= 0 && onTopEdge) return onTopEdge();
        next = Math.max(current - 1, 0);
        break;
      case 'Home': next = 0; break;
      default: next = items.length - 1;
    }
    items[next].focus();
  }

  private focusables(scope: HTMLElement = this.scroller().nativeElement): HTMLElement[] {
    return Array.from(scope.querySelectorAll<HTMLElement>('[data-nav]')).filter(
      (el) => !el.closest('[inert]') && el.offsetParent !== null,
    );
  }

  private firstMatch(): string | undefined {
    const row = this.view()[0]?.rows[0];
    return row?.route ?? row?.children?.[0]?.route;
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }

  private matchDesktop(): boolean {
    return typeof window === 'undefined' || !window.matchMedia || window.matchMedia(DESKTOP_QUERY).matches;
  }
}
