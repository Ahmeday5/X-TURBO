import { Route } from '@angular/router';

export type LoadComponent = NonNullable<Route['loadComponent']>;

/**
 * Nav route → lazy screen. Each feature exports one of these from its
 * `<feature>.pages.ts`; `app.routes.ts` merges them into BUILT_PAGES.
 */
export type PageRegistry = Readonly<Record<string, LoadComponent>>;
