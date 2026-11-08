import { Route, Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { accessGuard } from './core/auth/guards/access.guard';
import { NAV_LEAVES } from './core/constants/nav.constants';
import { NavLeaf } from './core/models/nav.model';
import { environment } from '../environments/environment';

/** Browser-tab title: "<page> · X-TURBO". */
const pageTitle = (page: string): string => `${page} · ${environment.appName}`;

type LoadComponent = NonNullable<Route['loadComponent']>;

/**
 * Nav pages with a real screen. Every other nav page gets the shared module
 * page, so a new screen only needs an entry here.
 */
const BUILT_PAGES: Readonly<Record<string, LoadComponent>> = {
  '/items/define': () => import('./features/items/pages/item-form/item-form.page').then((m) => m.ItemFormPage),
  '/items/groups': () => import('./features/items/pages/item-groups/item-groups.page').then((m) => m.ItemGroupsPage),
  '/items/directory': () =>
    import('./features/items/pages/items-directory/items-directory.page').then((m) => m.ItemsDirectoryPage),
};

const modulePage: LoadComponent = () =>
  import('./features/module-page/module-page.component').then((m) => m.ModulePageComponent);

/** Same OR-gate the sidebar applies, so a hidden page is also unreachable by URL. */
const gateFor = (leaf: NavLeaf): Route['canActivate'] =>
  leaf.permissions?.length || leaf.roles?.length
    ? [accessGuard({ anyPermission: leaf.permissions, anyRole: leaf.roles })]
    : [];

/**
 * One routed, guarded page per nav entry, derived from NAV_SECTIONS so the
 * sidebar and the router can never drift.
 */
const moduleRoutes: Route[] = NAV_LEAVES.filter((leaf) => leaf.route !== '/dashboard').map((leaf) => ({
  path: leaf.route.replace(/^\//, ''),
  title: pageTitle(leaf.label),
  canActivate: gateFor(leaf),
  data: { navId: leaf.id },
  loadComponent: BUILT_PAGES[leaf.route] ?? modulePage,
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
