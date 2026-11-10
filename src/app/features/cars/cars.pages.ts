import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const CARS_PAGES: PageRegistry = {
  '/items/cars': () => import('./pages/car-catalog/car-catalog.page').then((m) => m.CarCatalogPage),
};
