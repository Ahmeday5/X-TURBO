/**
 * Auth endpoint configuration — the only file you should need to touch to
 * point this starter's auth flow at a different backend.
 *
 * Every endpoint is relative to `environment.apiUrl` (see `ApiService`).
 */
export const AUTH_ENDPOINTS = {
  login: 'auth/login',
  register: 'auth/register',
  logout: 'auth/logout',
  refresh: 'auth/refresh-token',
  forgotPassword: 'auth/forgot-password',
  resetPassword: 'auth/reset-password',
  /** Authoritative current-user + permissions endpoint, fetched after login. */
  me: 'auth/me',
} as const;

/** Default route to send an authenticated user to after login/guard redirects. */
export const DEFAULT_AUTHENTICATED_ROUTE = '/dashboard';

/** Login route — used by guards and the auth service to redirect unauthenticated users. */
export const LOGIN_ROUTE = '/auth/login';
