import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { RowAction } from '../../../../shared/models/row-action.model';
import { AppCustomer, AppCustomerAction, appCustomerActions } from '../../models/app-customer.model';

/** Button style per action: activate green · block red · unblock neutral. */
const BUTTON_CLASS: Record<AppCustomerAction, string> = {
  activate: 'ui-btn--success',
  block: 'ui-btn--danger',
  unblock: 'ui-btn--ghost',
};

/**
 * Status buttons of an app customer (pending → تفعيل / حظر · active → حظر ·
 * blocked → فك الحظر). The same component in the table row, the card and the
 * details drawer, so all three always offer the same thing. Running the
 * action (confirm, API, toast) is the page's job.
 */
@Component({
  selector: 'app-customer-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @for (a of actions(); track a.key) {
      <button type="button" class="ui-btn" [class]="buttonClass(a)" [class.ui-btn--sm]="size() === 'sm'"
        [class.is-loading]="busy() && a.key === busyAction()" [disabled]="busy() || !!a.disabledReason"
        [title]="a.disabledReason ?? a.label + ' ' + customer().name"
        [attr.aria-label]="a.label + ' ' + customer().name + (a.disabledReason ? ' — ' + a.disabledReason : '')"
        (click)="$event.stopPropagation(); run.emit(a.key)">
        <app-icon [name]="a.icon" [size]="size() === 'sm' ? 14 : 15" /> {{ a.label }}
      </button>
    }
  `,
  styles: [':host { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }'],
})
export class AppCustomerActionsComponent {
  readonly customer = input.required<AppCustomer>();
  /** A status change of THIS customer is in flight. */
  readonly busy = input(false);
  readonly busyAction = input<AppCustomerAction | null>(null);
  readonly size = input<'sm' | 'md'>('sm');

  readonly run = output<AppCustomerAction>();

  protected readonly actions = computed(() => appCustomerActions(this.customer()));

  protected buttonClass(a: RowAction<AppCustomerAction>): string {
    return `ui-btn ${BUTTON_CLASS[a.key]}`;
  }
}
