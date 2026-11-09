export const environment = {
  production: false,
  appName: 'X-TURBO',
  appVersion: '1.0.0',
  defaultLang: 'ar',

  /** ISO-4217 code used by every money formatter in the UI. */
  currency: 'EGP',
  /** IANA zone every date is displayed in (the API buckets periods in Cairo time). */
  timeZone: 'Africa/Cairo',

  /** Hosted backend. For a local API use 'https://localhost:5001/api'. */
  apiUrl: 'https://xturbo.runasp.net/api',
  /**
   * Serve the API from the in-browser mock (src/app/mock) instead of `apiUrl`.
   * OFF: development talks to the real ASP.NET API at `apiUrl`.
   */
  mockApi: false,
  tokenKey: 'xturbo_access_token',
  refreshTokenKey: 'xturbo_refresh_token',
  /** Must match the key read by the anti-flash script in index.html. */
  themeKey: 'xturbo_theme',
};
