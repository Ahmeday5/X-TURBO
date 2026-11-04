import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/services/auth.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';

/** Placeholder landing page — replace with your real dashboard. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatCardComponent],
  template: `
    <div class="pgh">
      <div>
        <div class="pgt">Dashboard</div>
        <div class="pgs">Welcome back, {{ auth.currentUser()?.name }}</div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-md-4">
        <app-stat-card label="Example metric" value="1,024" sub="+12% this month" />
      </div>
      <div class="col-md-4">
        <app-stat-card label="Another metric" value="87" />
      </div>
      <div class="col-md-4">
        <app-stat-card label="Your role" [value]="auth.currentUser()?.role ?? '—'" />
      </div>
    </div>
  `,
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
}
