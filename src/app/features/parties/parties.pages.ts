import { PageRegistry } from '../../core/models/page-registry.model';

const statement = () => import('./pages/party-statement/party-statement.page').then((m) => m.PartyStatementPage);

/** Built screens of this feature, keyed by nav route (merged in app.routes.ts). */
export const PARTIES_PAGES: PageRegistry = {
  '/customers/card': () => import('./pages/party-form/party-form.page').then((m) => m.PartyFormPage),
  '/customers/list': () => import('./pages/party-list/party-list.page').then((m) => m.PartyListPage),
  // One screen, two variants — the page reads its navId.
  '/customers/statement': statement,
  '/customers/statement-detailed': statement,
  '/customers/balances': () => import('./pages/party-balances/party-balances.page').then((m) => m.PartyBalancesPage),
};
