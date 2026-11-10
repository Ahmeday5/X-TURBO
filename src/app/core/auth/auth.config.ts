/**
 * Client-side auth routes. API endpoints (`auth/login`, `auth/refresh-token`,
 * `auth/logout`, `auth/me`) live in `core/constants/api-endpoints.const.ts`
 * under `API_ENDPOINTS.auth`.
 */

/** Default route to send an authenticated user to after login/guard redirects. */
export const DEFAULT_AUTHENTICATED_ROUTE = '/dashboard';

/** Login route — used by guards and the auth service to redirect unauthenticated users. */
export const LOGIN_ROUTE = '/auth/login';
