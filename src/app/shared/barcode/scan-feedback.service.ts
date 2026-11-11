import { Injectable } from '@angular/core';

/**
 * Short audio cue after a scan, like a supermarket till: a high blip when the
 * item was added, a low buzz when nothing matched — so the cashier doesn't
 * have to look at the screen for every scan. Silently does nothing where Web
 * Audio isn't available or not yet allowed by the browser.
 */
@Injectable({ providedIn: 'root' })
export class ScanFeedbackService {
  private ctx: AudioContext | null = null;

  ok(): void {
    this.tone(1320, 0.07, 'sine');
  }

  miss(): void {
    this.tone(220, 0.18, 'square');
  }

  private tone(frequency: number, seconds: number, type: OscillatorType): void {
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + seconds);
    } catch {
      /* no audio — the visual feedback is enough */
    }
  }
}
