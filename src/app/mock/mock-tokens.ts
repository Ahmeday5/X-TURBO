import { decodeJwt, JwtPayload } from '../core/auth/utils/jwt.util';

/**
 * Unsigned, JWT-shaped tokens for the mock API. They decode exactly like real
 * ones (so AuthService's expiry scheduling and refresh flow run for real) but
 * carry no signature — they are worthless outside this dev mock.
 */

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

interface AccessClaims extends JwtPayload {
  sub: string;
  typ: 'access';
  iat: number;
  exp: number;
}

interface RefreshClaims extends JwtPayload {
  sub: string;
  typ: 'refresh';
  remember: boolean;
  exp: number;
  /** Uniqueness so every rotation yields a different token. */
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
}

export function issueTokens(userId: string, remember: boolean): IssuedTokens {
  const now = Date.now();
  const accessExp = now + ACCESS_TTL_MS;
  const refreshExp = now + (remember ? REFRESH_TTL_REMEMBER_MS : REFRESH_TTL_MS);

  const access: AccessClaims = { sub: userId, typ: 'access', iat: seconds(now), exp: seconds(accessExp) };
  const refresh: RefreshClaims = {
    sub: userId,
    typ: 'refresh',
    remember,
    exp: seconds(refreshExp),
    jti: Math.random().toString(36).slice(2),
  };

  return {
    accessToken: encode(access),
    refreshToken: encode(refresh),
    expiresAtUtc: new Date(accessExp).toISOString(),
  };
}

/** Returns the user id when the access token is well-formed and unexpired. */
export function verifyAccessToken(token: string | null): string | null {
  const claims = token ? decodeJwt<AccessClaims>(token) : null;
  return claims?.typ === 'access' && isLive(claims.exp) ? claims.sub : null;
}

export function verifyRefreshToken(token: string | null): RefreshClaims | null {
  const claims = token ? decodeJwt<RefreshClaims>(token) : null;
  return claims?.typ === 'refresh' && isLive(claims.exp) ? claims : null;
}

function encode(claims: object): string {
  return [base64Url({ alg: 'none', typ: 'JWT' }), base64Url(claims), 'mock-signature'].join('.');
}

function base64Url(value: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function seconds(ms: number): number {
  return Math.floor(ms / 1000);
}

function isLive(expSeconds: number | undefined): boolean {
  return typeof expSeconds === 'number' && expSeconds * 1000 > Date.now();
}
