import { normalizeHash } from './hash.js';

let replaceNavigationHandler = null;
let pendingHistoryMode = null;
let pendingHistoryHash = null;

function setPendingNavigation(hash, historyMode) {
  pendingHistoryHash = normalizeHash(hash);
  pendingHistoryMode = typeof historyMode === 'string' ? historyMode : 'push';
}

function clearPendingNavigation() {
  pendingHistoryHash = null;
  pendingHistoryMode = null;
}

export function setReplaceNavigationHandler(handler) {
  replaceNavigationHandler = typeof handler === 'function' ? handler : null;
}

export function consumePendingHistoryMode(nextHash) {
  if (!pendingHistoryMode || !pendingHistoryHash) {
    return null;
  }

  const normalizedNextHash = normalizeHash(nextHash);
  if (normalizedNextHash !== pendingHistoryHash) {
    clearPendingNavigation();
    return null;
  }

  const mode = pendingHistoryMode;
  clearPendingNavigation();
  return mode;
}

export function navigateTo(hash, options = {}) {
  const { replace = false, historyMode = 'push' } = options;
  const normalizedHash = normalizeHash(hash);

  if (replace) {
    clearPendingNavigation();
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', `${pathname}${search}${normalizedHash}`);
    if (replaceNavigationHandler) {
      void replaceNavigationHandler();
    }
    return;
  }

  if (window.location.hash === normalizedHash) {
    clearPendingNavigation();
    return;
  }

  setPendingNavigation(normalizedHash, historyMode);
  window.location.hash = normalizedHash;
}
