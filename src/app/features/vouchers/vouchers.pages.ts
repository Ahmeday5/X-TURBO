import { LoadComponent, PageRegistry } from '../../core/models/page-registry.model';
import { VOUCHER_KIND_CONFIG } from './models/voucher.model';
import { VOUCHER_KINDS } from './utils/voucher-view';

const vouchersPage: LoadComponent = () => import('./pages/vouchers/vouchers.page').then((m) => m.VouchersPage);

/**
 * Built screens of this feature, keyed by nav route (merged in app.routes.ts).
 * Journal, receipt and payment vouchers share one screen; the kind follows the route.
 */
export const VOUCHERS_PAGES: PageRegistry = Object.fromEntries(VOUCHER_KINDS.map((k) => [VOUCHER_KIND_CONFIG[k].route, vouchersPage]));
