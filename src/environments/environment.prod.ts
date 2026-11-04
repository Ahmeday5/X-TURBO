export const environment = {
  production: true,
  appName: 'X-TURBO',
  appVersion: '1.0.0',
  defaultLang: 'ar',

  /** ISO-4217 code used by every money formatter in the UI. */
  currency: 'EGP',

  apiUrl: 'https://api.example.com/api',
  /** Never serve mock data in production. */
  mockApi: false,
  tokenKey: 'xturbo_access_token',
  refreshTokenKey: 'xturbo_refresh_token',
  /** Must match the key read by the anti-flash script in index.html. */
  themeKey: 'xturbo_theme',
};
