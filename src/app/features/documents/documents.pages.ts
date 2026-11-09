import { LoadComponent, PageRegistry } from '../../core/models/page-registry.model';
import { DOC_KIND_CONFIG, DOC_KINDS } from './models/document.model';

const documentsPage: LoadComponent = () => import('./pages/documents/documents.page').then((m) => m.DocumentsPage);

/**
 * Built screens of this feature, keyed by nav route (merged in app.routes.ts).
 * Every document kind (invoices, returns, transfers, goods issue / receipt,
 * quotations, reservations) shares one screen; the kind follows the route.
 */
export const DOCUMENTS_PAGES: PageRegistry = Object.fromEntries(DOC_KINDS.map((k) => [DOC_KIND_CONFIG[k].route, documentsPage]));
