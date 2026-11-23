import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const APP_CUSTOMERS_PAGES: PageRegistry = {
  '/app-customers': () => import('./pages/app-customers/app-customers.page').then((m) => m.AppCustomersPage),
};
