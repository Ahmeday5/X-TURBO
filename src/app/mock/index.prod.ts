import { HttpInterceptorFn } from '@angular/common/http';
import { DemoAccount } from './demo-account.model';

/** Production stand-in for `index.ts` — the mock API does not exist here. */

export type { DemoAccount } from './demo-account.model';

export const MOCK_API_INTERCEPTORS: HttpInterceptorFn[] = [];

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [];
