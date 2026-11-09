import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const PAYMENTS_PAGES: PageRegistry = {
  '/payments': () => import('./pages/payments/payments.page').then((m) => m.PaymentsPage),
};
