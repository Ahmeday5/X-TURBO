import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const ACCOUNTS_PAGES: PageRegistry = {
  '/accounts/chart': () => import('./pages/accounts-chart/accounts-chart.page').then((m) => m.AccountsChartPage),
  '/accounts/card': () => import('./pages/account-form/account-form.page').then((m) => m.AccountFormPage),
  '/accounts/employees': () => import('./pages/employees/employees.page').then((m) => m.EmployeesPage),
  '/accounts/cost-centers': () => import('./pages/cost-centers/cost-centers.page').then((m) => m.CostCentersPage),
  '/accounts/budget': () => import('./pages/budget/budget.page').then((m) => m.BudgetPage),
  '/accounts/exchange-rates': () => import('./pages/exchange-rates/exchange-rates.page').then((m) => m.ExchangeRatesPage),
};
