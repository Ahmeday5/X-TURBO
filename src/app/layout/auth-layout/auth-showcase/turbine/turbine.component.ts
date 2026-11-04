import { ChangeDetectionStrategy, Component } from '@angular/core';

const BLADE_COUNT = 10;
const TICK_COUNT = 60;

/**
 * Animated turbo-charger illustration echoing the X-TURBO mark: a spinning
 * impeller inside a volute, counter-rotating gauge rings and an orbiting
 * light. Pure SVG + CSS animation — no JS per frame.
 */
@Component({
  selector: 'app-turbine',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './turbine.component.html',
  styleUrl: './turbine.component.scss',
})
export class TurbineComponent {
  protected readonly blades = Array.from({ length: BLADE_COUNT }, (_, i) => (360 / BLADE_COUNT) * i);
  protected readonly ticks = Array.from({ length: TICK_COUNT }, (_, i) => ({
    angle: (360 / TICK_COUNT) * i,
    major: i % 5 === 0,
  }));
}
