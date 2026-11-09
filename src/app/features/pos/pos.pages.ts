import { PageRegistry } from '../../core/models/page-registry.model';

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const POS_PAGES: PageRegistry = {
  '/pos/terminal': () => import('./pages/pos-terminal/pos-terminal.page').then((m) => m.PosTerminalPage),
  '/pos/settings': () => import('./pages/pos-settings/pos-settings.page').then((m) => m.PosSettingsPage),
  '/pos/external-customers': () =>
    import('./pages/external-customers/external-customers.page').then((m) => m.ExternalCustomersPage),
};
