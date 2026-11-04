import { signal } from '@angular/core';

/**
 * Drives the `.is-shaking` error animation on auth forms (see auth-view.scss).
 *
 *   <form [class.is-shaking]="shake.active()" (animationend)="shake.onAnimationEnd($event)">
 *
 * Plain class (not a service): each form owns its own instance.
 */
export class FormShake {
  readonly active = signal(false);

  play(): void {
    this.active.set(true);
  }

  onAnimationEnd(event: AnimationEvent): void {
    // Keyframe names are scoped by view encapsulation, hence endsWith.
    if (event.animationName.endsWith('av-shake')) this.active.set(false);
  }
}
