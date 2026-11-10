import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const DELIVERY_ZONES_PAGES: PageRegistry = {
  '/delivery-zones': () =>
    import('./pages/delivery-zones/delivery-zones.page').then((m) => m.DeliveryZonesPage),
};
