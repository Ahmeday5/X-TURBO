import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopbarComponent } from './topbar/topbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { LayoutService } from '../../core/services/layout.service';
import { DeliveryStatsService } from '../../features/drivers/services/delivery-stats.service';
import { AppCustomerStatsService } from '../../features/app-customers/services/app-customer-stats.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TopbarComponent, SidebarComponent, ConfirmDialogComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  protected readonly layout = inject(LayoutService);

  constructor() {
    // Starts the delivery counters poll (sidebar badge) for the signed-in session.
    inject(DeliveryStatsService);
    // Pending app sign-ups (sidebar badge on "عملاء التطبيق").
    inject(AppCustomerStatsService);
  }
}
