import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const NOTIFICATIONS_PAGES: PageRegistry = {
  '/mobile-notifications': () =>
    import('./pages/mobile-notifications/mobile-notifications.page').then((m) => m.MobileNotificationsPage),
};
