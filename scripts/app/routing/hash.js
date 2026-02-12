import {
  AUTH_MODE_FORGOT,
  AUTH_MODE_LOGIN,
  HOME_HASH
} from '../constants.js';

function parseQuery(queryString) {
  const params = new URLSearchParams(queryString || '');
  const query = {};

  params.forEach((value, key) => {
    query[key] = value;
  });

  return query;
}

export function normalizeAuthMode(inputMode) {
  if (typeof inputMode !== 'string') {
    return AUTH_MODE_LOGIN;
  }

  const mode = inputMode.trim().toLowerCase();
  if (mode === AUTH_MODE_FORGOT || mode === 'recovery') {
    return AUTH_MODE_FORGOT;
  }

  return AUTH_MODE_LOGIN;
}

export function getAuthModeFromRoute(route) {
  if (!route || !route.query) {
    return AUTH_MODE_LOGIN;
  }

  return normalizeAuthMode(route.query.mode);
}

export function normalizeHash(inputHash) {
  if (!inputHash || inputHash === '#') {
    return HOME_HASH;
  }

  if (!inputHash.startsWith('#')) {
    return `#${inputHash}`;
  }

  if (inputHash === '#/') {
    return HOME_HASH;
  }

  return inputHash;
}

export function parseHash(inputHash) {
  const fullHash = normalizeHash(inputHash);
  const rawHash = fullHash.slice(1);
  const [rawPath = '/', rawQuery = ''] = rawHash.split('?');
  const path = rawPath || '/';
  const query = parseQuery(rawQuery);

  if (path === '/') {
    return {
      name: 'home',
      params: {},
      query,
      path,
      fullHash
    };
  }

  if (path === '/catalog') {
    return {
      name: 'catalog',
      params: {},
      query,
      path,
      fullHash
    };
  }

  if (path === '/auth') {
    return {
      name: 'auth',
      params: {},
      query,
      path,
      fullHash
    };
  }

  if (path === '/account') {
    return {
      name: 'account',
      params: {},
      query,
      path,
      fullHash
    };
  }

  const materialMatch = path.match(/^\/material\/(\d+)$/);
  if (materialMatch) {
    return {
      name: 'material',
      params: {
        id: Number(materialMatch[1])
      },
      query,
      path,
      fullHash
    };
  }

  return {
    name: 'unknown',
    params: {},
    query,
    path,
    fullHash
  };
}

export function sanitizeRedirectHash(candidate) {
  if (typeof candidate !== 'string') {
    return null;
  }

  const value = candidate.trim();
  if (!value.startsWith('#/')) {
    return null;
  }

  const parsed = parseHash(value);
  if (parsed.name === 'unknown') {
    return null;
  }

  return parsed.fullHash;
}

export function buildAuthHash(redirectHash, options = {}) {
  const { mode = AUTH_MODE_LOGIN } = options;
  const normalizedMode = normalizeAuthMode(mode);
  const params = new URLSearchParams();
  const safeRedirect = sanitizeRedirectHash(redirectHash);

  if (safeRedirect) {
    params.set('redirect', safeRedirect);
  }

  if (normalizedMode !== AUTH_MODE_LOGIN) {
    params.set('mode', normalizedMode);
  }

  const query = params.toString();
  return query ? `#/auth?${query}` : '#/auth';
}
