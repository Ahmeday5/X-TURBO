import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StatusView } from '../../models/status-tone.model';

/**
 * Dot + label status chip, driven by a `StatusView` from a feature's display map.
 *
 *   <app-status-pill [view]="ORDER_STATUS_VIEW[order.status]" />
 */
@Component({
  selector: 'app-status-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'status-pill status-pill--' + view().tone">{{ view().label }}</span>`,
  styles: [':host { display: inline-flex; }'],
})
export class StatusPillComponent {
  readonly view = input.required<Pick<StatusView, 'label' | 'tone'>>();
}
