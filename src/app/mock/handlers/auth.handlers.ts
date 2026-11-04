import { AUTH_ENDPOINTS } from '../../core/auth/auth.config';
import {
  AuthResponseData,
  LoginRequest,
  MePermissionsData,
  RefreshTokenRequest,
} from '../../core/auth/models/auth.model';
import { fail, MockContext, MockRoute, ok } from '../mock-http';
import { issueTokens, verifyRefreshToken } from '../mock-tokens';
import { findUserByEmail, findUserById, MockUser } from '../mock-users';

function login({ req }: MockContext) {
  const body = req.body as LoginRequest;
  const user = findUserByEmail(body?.email ?? '');
  if (!user || user.password !== body?.password) {
    throw fail(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة', req.url);
  }
  return ok(toAuthResponse(user, !!body.rememberMe));
}

function refresh({ req }: MockContext) {
  const claims = verifyRefreshToken((req.body as RefreshTokenRequest)?.refreshToken ?? null);
  const user = claims ? findUserById(claims.sub) : undefined;
  if (!claims || !user) throw fail(401, 'انتهت صلاحية الجلسة', req.url);
  return ok(toAuthResponse(user, claims.remember));
}

function me({ req, userId }: MockContext) {
  const user = userId ? findUserById(userId) : undefined;
  if (!user) throw fail(401, 'غير مصرح', req.url);
  const data: MePermissionsData = {
    userId: user.id,
    userName: user.name,
    email: user.email,
    role: user.role,
    permissions: [...user.permissions],
  };
  return ok(data);
}

function toAuthResponse(user: MockUser, remember: boolean): AuthResponseData {
  return {
    ...issueTokens(user.id, remember),
    userId: user.id,
    email: user.email,
    userName: user.name,
    role: user.role,
    permissions: [...user.permissions],
  };
}

export const AUTH_MOCK_ROUTES: MockRoute[] = [
  { method: 'POST', path: AUTH_ENDPOINTS.login, protected: false, handle: login },
  { method: 'POST', path: AUTH_ENDPOINTS.refresh, protected: false, handle: refresh },
  // The auth interceptor sends logout without a Bearer header (by design).
  { method: 'POST', path: AUTH_ENDPOINTS.logout, protected: false, handle: () => ok(null) },
  { method: 'GET', path: AUTH_ENDPOINTS.me, protected: true, handle: me },
];
