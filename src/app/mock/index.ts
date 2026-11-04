import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { roleLabel } from '../core/auth/roles';
import { DemoAccount } from './demo-account.model';
import { mockApiInterceptor } from './mock-api.interceptor';
import { DEMO_USERS } from './mock-users';

/**
 * Public surface of the dev mock. Production builds swap this file for
 * `index.prod.ts` (angular.json → fileReplacements), so no mock code or demo
 * credentials ever reach a production bundle.
 */

export type { DemoAccount } from './demo-account.model';

export const MOCK_API_INTERCEPTORS: HttpInterceptorFn[] = environment.mockApi ? [mockApiInterceptor] : [];

export const DEMO_ACCOUNTS: readonly DemoAccount[] = environment.mockApi
  ? DEMO_USERS.map(({ name, email, password, role }) => ({ name, email, password, role: roleLabel(role) }))
  : [];
