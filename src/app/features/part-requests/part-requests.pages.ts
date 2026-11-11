import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const PART_REQUESTS_PAGES: PageRegistry = {
  '/part-requests': () =>
    import('./pages/part-requests/part-requests.page').then((m) => m.PartRequestsPage),
};
