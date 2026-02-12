import { normalizeHash } from './hash.js';

let replaceNavigationHandler = null;

export function setReplaceNavigationHandler(handler) {
  replaceNavigationHandler = typeof handler === 'function' ? handler : null;
}

export function navigateTo(hash, options = {}) {
  const { replace = false } = options;
  const normalizedHash = normalizeHash(hash);

  if (replace) {
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', `${pathname}${search}${normalizedHash}`);
    if (replaceNavigationHandler) {
      void replaceNavigationHandler();
    }
    return;
  }

  if (window.location.hash === normalizedHash) {
    return;
  }

  window.location.hash = normalizedHash;
}
