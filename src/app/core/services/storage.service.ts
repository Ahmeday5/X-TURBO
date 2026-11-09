import { Injectable } from '@angular/core';

/**
 * `local` survives browser restarts and is shared by every tab; `session`
 * lives only as long as the tab (used for "don't remember me" logins).
 */
export type StorageArea = 'local' | 'session';

/**
 * Thin wrapper around Web Storage that:
 *   - never throws (handles SSR / disabled storage / quota errors)
 *   - serializes JSON via typed helpers
 *   - defaults to `localStorage`; pass `'session'` for `sessionStorage`
 *
 * All app code must go through this service so we have a single seam to swap
 * implementations (e.g. cookies, IndexedDB) later if needed.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private store(area: StorageArea): Storage | null {
    try {
      if (area === 'session') {
        return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
      }
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  }

  get(key: string, area: StorageArea = 'local'): string | null {
    try {
      return this.store(area)?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  set(key: string, value: string, area: StorageArea = 'local'): void {
    try {
      this.store(area)?.setItem(key, value);
    } catch {
      /* quota / disabled — ignore */
    }
  }

  remove(key: string, area: StorageArea = 'local'): void {
    try {
      this.store(area)?.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  getJson<T>(key: string, area: StorageArea = 'local'): T | null {
    const raw = this.get(key, area);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setJson<T>(key: string, value: T, area: StorageArea = 'local'): void {
    try {
      this.set(key, JSON.stringify(value), area);
    } catch {
      /* circular / non-serializable — ignore */
    }
  }
}
