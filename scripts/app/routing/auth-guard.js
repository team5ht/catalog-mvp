import { buildAuthHash, sanitizeRedirectHash } from './hash.js';

export function resolveAuthRedirect(route, authed) {
  if (!route || typeof route !== 'object') {
    return null;
  }

  if (route.name === 'auth') {
    if (!authed) {
      return null;
    }

    if (typeof window !== 'undefined' && window.__AUTH_MVP_V2_BLOCK_AUTH_REDIRECT) {
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
