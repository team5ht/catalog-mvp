import { buildAuthHash, sanitizeRedirectHash } from './hash.js';
import { isAuthRedirectLockActive } from '../services/auth-redirect-coordinator.js';

export function resolveAuthRedirect(route, authed) {
  if (!route || typeof route !== 'object') {
    return null;
  }

  if (route.name === 'auth') {
    if (!authed) {
      return null;
    }

    if (isAuthRedirectLockActive()) {
      return null;
    }

    return sanitizeRedirectHash(route.query?.redirect) || '#/account';
  }

  if (route.name === 'account') {
    if (authed) {
      return null;
    }

    return buildAuthHash('#/account');
  }

  return null;
}
