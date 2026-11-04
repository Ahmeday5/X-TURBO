export const environment = {
  production: false,
  appName: 'X-TURBO',
  appVersion: '1.0.0',
  defaultLang: 'ar',

  /** ISO-4217 code used by every money formatter in the UI. */
  currency: 'EGP',

  apiUrl: 'https://localhost:5001/api',
  /**
   * Serve the API from the in-browser mock (src/app/mock) instead of `apiUrl`.
   * Turn OFF as soon as the real backend is reachable.
   */
  mockApi: true,
  tokenKey: 'xturbo_access_token',
  refreshTokenKey: 'xturbo_refresh_token',
  /** Must match the key read by the anti-flash script in index.html. */
  themeKey: 'xturbo_theme',
};
