import { Route, Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { permissionGuard } from './core/auth/guards/permission.guard';
import { NAV_SECTIONS } from './core/constants/nav.constants';
import { MenuItem } from './core/models/menu-item.model';
import { environment } from '../environments/environment';

/** Browser-tab title: "<page> · X-TURBO". */
const pageTitle = (page: string): string => `${page} · ${environment.appName}`;

/** Nav items whose real pages exist — every other nav entry gets a placeholder route. */
const BUILT_ROUTES = new Set(['/dashboard']);

/**
 * Routed, permission-guarded placeholder for each module still in development.
 * Derived from NAV_SECTIONS so the sidebar and the router can never drift.
 */
const moduleRoutes: Route[] = NAV_SECTIONS.flatMap((s) => s.items)
  .filter((item) => !BUILT_ROUTES.has(item.route))
  .map((item: MenuItem) => ({
    path: item.route.replace(/^\//, ''),
    title: pageTitle(item.label),
    canActivate: item.permissions?.length ? [permissionGuard(item.permissions, { mode: 'any' })] : [],
    data: { title: item.label, icon: item.icon },
    loadComponent: () =>
      import('./features/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
  }));

export const routes: Routes = [
  // Auth area — only reachable when NOT signed in
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./layout/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        title: pageTitle('تسجيل الدخول'),
        loadComponent: () =>
          import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent),
      },
      { path: '**', redirectTo: 'login' },
    ],
  },

  // Authenticated app shell
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        title: pageTitle('لوحة التحكم'),
        // Landing page — not permission-gated: every fallback redirect points here.
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      ...moduleRoutes,
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: '/dashboard' },
];
