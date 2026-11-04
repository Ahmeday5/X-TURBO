import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

/** Screen point the theme-change reveal expands from (viewport px). */
export interface ThemeTransitionOrigin {
  x: number;
  y: number;
}

const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const TRANSITION_CLASS = 'theme-transition';

/**
 * Owns the light/dark theme.
 *
 *   - `preference` is what the user picked (light / dark / follow system)
 *     and is persisted; `theme` is what is actually rendered.
 *   - The resolved theme is written to `<html data-theme>` (our tokens) and
 *     `<html data-bs-theme>` (Bootstrap 5.3), plus the `theme-color` meta.
 *   - index.html applies the stored theme before Angular boots, so there is
 *     no light flash on reload; this service then takes over.
 *   - Switching uses the View Transitions API for a circular reveal from the
 *     clicked control, falling back to an instant swap where unsupported or
 *     when the user prefers reduced motion.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);

  private readonly darkQuery = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  private readonly systemPrefersDark = signal(this.darkQuery?.matches ?? false);

  readonly preference = signal<ThemePreference>(this.readStoredPreference());

  readonly theme = computed<Theme>(() => {
    const pref = this.preference();
    if (pref !== 'system') return pref;
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    this.darkQuery?.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));
    effect(() => this.applyToDocument(this.theme()));
  }

  setPreference(preference: ThemePreference, origin?: ThemeTransitionOrigin): void {
    if (preference === this.preference()) return;

    const commit = (): void => {
      this.preference.set(preference);
      this.storage.set(environment.themeKey, preference);
      // Apply synchronously so the view transition snapshots the new theme;
      // the effect re-applies the same value afterwards (idempotent).
      this.applyToDocument(this.theme());
    };

    this.runWithTransition(commit, origin);
  }

  /** Flip between light and dark (an explicit choice — leaves "system"). */
  toggle(origin?: ThemeTransitionOrigin): void {
    this.setPreference(this.isDark() ? 'light' : 'dark', origin);
  }

  private runWithTransition(commit: () => void, origin?: ThemeTransitionOrigin): void {
    const doc = this.document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    const win = doc.defaultView;
    const reduceMotion = win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    if (!doc.startViewTransition || !win || reduceMotion) {
      commit();
      return;
    }

    const root = doc.documentElement;
    const x = origin?.x ?? win.innerWidth / 2;
    const y = origin?.y ?? win.innerHeight / 2;
    // Radius that reaches the farthest viewport corner from the origin.
    const r = Math.hypot(Math.max(x, win.innerWidth - x), Math.max(y, win.innerHeight - y));

    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-r', `${r}px`);
    root.classList.add(TRANSITION_CLASS);

    doc
      .startViewTransition(commit)
      .finished.finally(() => {
        root.classList.remove(TRANSITION_CLASS);
        root.style.removeProperty('--vt-x');
        root.style.removeProperty('--vt-y');
        root.style.removeProperty('--vt-r');
      });
  }

  private applyToDocument(theme: Theme): void {
    const root = this.document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-bs-theme', theme);
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0a0a0b' : '#ffffff');
  }

  private readStoredPreference(): ThemePreference {
    const stored = this.storage.get(environment.themeKey) as ThemePreference | null;
    return stored && PREFERENCES.includes(stored) ? stored : 'system';
  }
}
