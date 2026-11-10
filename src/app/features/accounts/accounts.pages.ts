import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const ACCOUNTS_PAGES: PageRegistry = {
  '/accounts/chart': () => import('./pages/accounts-chart/accounts-chart.page').then((m) => m.AccountsChartPage),
  '/accounts/card': () => import('./pages/account-form/account-form.page').then((m) => m.AccountFormPage),
  '/accounts/cost-centers': () => import('./pages/cost-centers/cost-centers.page').then((m) => m.CostCentersPage),
};
