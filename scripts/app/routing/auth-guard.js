import { AUTH_MODE_LOGIN, HOME_HASH } from '../constants.js';
import { buildAuthHash, getAuthModeFromRoute, sanitizeRedirectHash } from './hash.js';

export function resolveAuthRedirect(route, authed) {
  if (!route || typeof route !== 'object') {
    return null;
  }

  if (route.name === 'auth') {
    if (!authed) {
      return null;
    }

    const authMode = getAuthModeFromRoute(route);
    if (authMode !== AUTH_MODE_LOGIN) {
      return null;
    }

    return sanitizeRedirectHash(route.query?.redirect) || HOME_HASH;
  }

  if (route.name === 'account') {
    if (authed) {
      return null;
    }

    return buildAuthHash('#/account');
  }

  return null;
}
