import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const WAREHOUSES_PAGES: PageRegistry = {
  '/warehouses/define': () =>
    import('./pages/warehouse-form/warehouse-form.page').then((m) => m.WarehouseFormPage),
  '/warehouses': () =>
    import('./pages/warehouses-directory/warehouses-directory.page').then((m) => m.WarehousesDirectoryPage),
  '/warehouses/purchase-review': () =>
    import('./pages/purchase-review/purchase-review.page').then((m) => m.PurchaseReviewPage),
  '/stock': () => import('./pages/stock/stock.page').then((m) => m.StockPage),
};
