import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  viewChild,
} from '@angular/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}

const LINK_DISTANCE = 115;
const POINTER_DISTANCE = 160;
const AREA_PER_PARTICLE = 15000;
const MIN_PARTICLES = 24;
const MAX_PARTICLES = 95;
const MAX_DPR = 2;

/**
 * Decorative canvas of rising particles linked into a network, with links
 * reaching toward the pointer. Fills its positioned parent.
 *
 * Performance contract: renders outside NgZone, caps device-pixel-ratio,
 * scales particle count with area, and stops the loop while the tab is
 * hidden or the canvas is off-screen / zero-sized. Reduced-motion users get
 * a single static frame.
 */
@Component({
  selector: 'app-particle-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: [
    `
      :host { position: absolute; inset: 0; display: block; pointer-events: none; }
      canvas { display: block; width: 100%; height: 100%; }
    `,
  ],
})
export class ParticleFieldComponent {
  /** Particle/link colour as an `r, g, b` triplet. */
  readonly rgb = input<string>('239, 43, 50');
  /** Multiplier on the area-based particle count. */
  readonly density = input<number>(1);

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private width = 0;
  private height = 0;
  private frame = 0;
  private visible = true;
  private pointer: { x: number; y: number } | null = null;

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.init()));
  }

  private init(): void {
    const canvas = this.canvasRef().nativeElement;
    const win = canvas.ownerDocument.defaultView;
    this.ctx = canvas.getContext('2d');
    if (!win || !this.ctx) return;

    const reduceMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const resizeObserver = new ResizeObserver(() => {
      this.resize(canvas, win);
      if (reduceMotion) this.draw();
    });
    resizeObserver.observe(canvas);

    if (reduceMotion) {
      this.destroyRef.onDestroy(() => resizeObserver.disconnect());
      return;
    }

    const intersection = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.syncLoop(win);
    });
    intersection.observe(canvas);

    const onVisibility = (): void => this.syncLoop(win);
    const onPointerMove = (e: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      this.pointer = inside ? { x, y } : null;
    };

    canvas.ownerDocument.addEventListener('visibilitychange', onVisibility);
    win.addEventListener('pointermove', onPointerMove, { passive: true });

    this.destroyRef.onDestroy(() => {
      resizeObserver.disconnect();
      intersection.disconnect();
      canvas.ownerDocument.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('pointermove', onPointerMove);
      this.stop(win);
    });

    this.syncLoop(win);
  }

  private resize(canvas: HTMLCanvasElement, win: Window): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(win.devicePixelRatio || 1, MAX_DPR);
    this.width = rect.width;
    this.height = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.seed();
  }

  private seed(): void {
    const target = Math.round(((this.width * this.height) / AREA_PER_PARTICLE) * this.density());
    const count = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, target));
    this.particles = Array.from({ length: count }, () => this.spawn(Math.random() * this.height));
  }

  private spawn(y: number): Particle {
    return {
      x: Math.random() * this.width,
      y,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.12 + Math.random() * 0.38), // rising, like heat off a turbo
      r: 0.6 + Math.random() * 1.6,
      a: 0.25 + Math.random() * 0.6,
    };
  }

  private syncLoop(win: Window): void {
    const shouldRun = this.visible && !win.document.hidden && this.width > 0;
    if (shouldRun && !this.frame) {
      const tick = (): void => {
        this.step();
        this.draw();
        this.frame = win.requestAnimationFrame(tick);
      };
      this.frame = win.requestAnimationFrame(tick);
    } else if (!shouldRun) {
      this.stop(win);
    }
  }

  private stop(win: Window): void {
    if (this.frame) win.cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private step(): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) Object.assign(p, this.spawn(this.height + 10));
      if (p.x < -10) p.x = this.width + 10;
      else if (p.x > this.width + 10) p.x = -10;
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const rgb = this.rgb();
    const pts = this.particles;

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.lineWidth = 0.7;

    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK_DISTANCE * LINK_DISTANCE) continue;
        const alpha = (1 - Math.sqrt(d2) / LINK_DISTANCE) * 0.22;
        ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    const ptr = this.pointer;
    if (ptr) {
      for (const p of pts) {
        const d = Math.hypot(p.x - ptr.x, p.y - ptr.y);
        if (d > POINTER_DISTANCE) continue;
        ctx.strokeStyle = `rgba(255, 255, 255, ${((1 - d / POINTER_DISTANCE) * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(ptr.x, ptr.y);
        ctx.stroke();
      }
    }

    for (const p of pts) {
      ctx.fillStyle = `rgba(${rgb}, ${p.a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
