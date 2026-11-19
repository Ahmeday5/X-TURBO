import { PageRegistry } from '../../core/models/page-registry.model';

export const DRIVERS_PAGES: PageRegistry = {
  '/drivers': () => import('./pages/drivers/drivers.page').then((m) => m.DriversPage),
  '/order-problems': () => import('./pages/order-problems/order-problems.page').then((m) => m.OrderProblemsPage),
};
