import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { LoaderComponent } from './shared/components/loader/loader.component';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoaderComponent, ToastComponent],
  template: `
    <app-loader />
    <app-toast />
    <router-outlet />
  `,
})
export class AppComponent {
  /** Eagerly instantiated so the theme tracks OS changes from the first route. */
  private readonly theme = inject(ThemeService);
}
