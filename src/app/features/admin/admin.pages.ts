import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const ADMIN_PAGES: PageRegistry = {
  '/users': () => import('./pages/users/users.page').then((m) => m.UsersPage),
  '/settings': () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
};
