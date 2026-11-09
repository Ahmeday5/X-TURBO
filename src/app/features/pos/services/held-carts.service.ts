import { Injectable, signal } from '@angular/core';
import { HeldCart } from '../models/pos-cart.model';

const KEY = 'xturbo_pos_held_carts';
const MAX_HELD = 12;

/**
 * Parked carts, persisted in localStorage so a refresh doesn't lose them.
 * Per-browser convenience only — storage can be unavailable (private mode),
 * in which case carts live for the session.
 */
@Injectable({ providedIn: 'root' })
export class HeldCartsService {
  private readonly carts = signal<HeldCart[]>(this.read());
  readonly list = this.carts.asReadonly();

  hold(cart: Omit<HeldCart, 'id' | 'at'>): HeldCart {
    const held: HeldCart = { ...cart, id: `h-${Date.now().toString(36)}`, at: new Date().toISOString() };
    this.carts.update((list) => [held, ...list].slice(0, MAX_HELD));
    this.write();
    return held;
  }

  /** Removes and returns the cart. */
  take(id: string): HeldCart | null {
    const cart = this.carts().find((c) => c.id === id) ?? null;
    if (cart) this.remove(id);
    return cart;
  }

  remove(id: string): void {
    this.carts.update((list) => list.filter((c) => c.id !== id));
    this.write();
  }

  private read(): HeldCart[] {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? (parsed as HeldCart[]) : [];
    } catch {
      return [];
    }
  }

  private write(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.carts()));
    } catch {
      /* storage unavailable — keep in memory */
    }
  }
}
