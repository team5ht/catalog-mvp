const state = {
  currentRoute: null,
  currentRenderToken: 0,
  catalogUiState: {
    categoryId: 0,
    query: ''
  },
  inAppRouteHistory: [],
  inAppRouteHistoryIndex: -1
};

const HISTORY_MODE_AUTO = 'auto';
const HISTORY_MODE_INITIAL = 'initial';
const HISTORY_MODE_PUSH = 'push';
const HISTORY_MODE_REPLACE = 'replace';

const NAVIGATION_TYPE_INITIAL = 'initial';
const NAVIGATION_TYPE_PUSH = 'push';
const NAVIGATION_TYPE_REPLACE = 'replace';
const NAVIGATION_TYPE_POP = 'pop';
const NAVIGATION_TYPE_NOOP = 'noop';

function normalizeHistoryMode(mode) {
  if (
    mode === HISTORY_MODE_INITIAL
    || mode === HISTORY_MODE_PUSH
    || mode === HISTORY_MODE_REPLACE
  ) {
    return mode;
  }

  return HISTORY_MODE_AUTO;
}

export function getCurrentRoute() {
  return state.currentRoute;
}

export function setCurrentRoute(route) {
  state.currentRoute = route;
}

export function nextRenderToken() {
  state.currentRenderToken += 1;
  return state.currentRenderToken;
}

export function isCurrentRender(renderToken) {
  return renderToken === state.currentRenderToken;
}

export function getCatalogUiState() {
  return state.catalogUiState;
}

export function recordRouteVisit(hash, mode = HISTORY_MODE_AUTO) {
  if (typeof hash !== 'string' || hash.length === 0) {
    return NAVIGATION_TYPE_NOOP;
  }

  const historyMode = normalizeHistoryMode(mode);

  if (historyMode === HISTORY_MODE_INITIAL) {
    const currentHash = state.inAppRouteHistory[state.inAppRouteHistoryIndex];
    if (currentHash === hash && state.inAppRouteHistoryIndex === 0 && state.inAppRouteHistory.length === 1) {
      return NAVIGATION_TYPE_NOOP;
    }

    state.inAppRouteHistory = [hash];
    state.inAppRouteHistoryIndex = 0;
    return NAVIGATION_TYPE_INITIAL;
  }

  if (state.inAppRouteHistory.length === 0 || state.inAppRouteHistoryIndex < 0) {
    state.inAppRouteHistory = [hash];
    state.inAppRouteHistoryIndex = 0;
    return historyMode === HISTORY_MODE_REPLACE ? NAVIGATION_TYPE_REPLACE : NAVIGATION_TYPE_PUSH;
  }

  const currentHash = state.inAppRouteHistory[state.inAppRouteHistoryIndex];
  if (currentHash === hash) {
    return NAVIGATION_TYPE_NOOP;
  }

  if (historyMode === HISTORY_MODE_PUSH) {
    state.inAppRouteHistory = state.inAppRouteHistory.slice(0, state.inAppRouteHistoryIndex + 1);
    state.inAppRouteHistory.push(hash);
    state.inAppRouteHistoryIndex = state.inAppRouteHistory.length - 1;
    return NAVIGATION_TYPE_PUSH;
  }

  if (historyMode === HISTORY_MODE_REPLACE) {
    state.inAppRouteHistory[state.inAppRouteHistoryIndex] = hash;
    return NAVIGATION_TYPE_REPLACE;
  }

  const previousIndex = state.inAppRouteHistoryIndex - 1;
  if (previousIndex >= 0 && state.inAppRouteHistory[previousIndex] === hash) {
    state.inAppRouteHistoryIndex = previousIndex;
    return NAVIGATION_TYPE_POP;
  }

  const nextIndex = state.inAppRouteHistoryIndex + 1;
  if (nextIndex < state.inAppRouteHistory.length && state.inAppRouteHistory[nextIndex] === hash) {
    state.inAppRouteHistoryIndex = nextIndex;
    return NAVIGATION_TYPE_POP;
  }

  state.inAppRouteHistory = state.inAppRouteHistory.slice(0, state.inAppRouteHistoryIndex + 1);
  state.inAppRouteHistory.push(hash);
  state.inAppRouteHistoryIndex = state.inAppRouteHistory.length - 1;
  return NAVIGATION_TYPE_PUSH;
}

export function canGoBackInApp() {
  return state.inAppRouteHistoryIndex > 0;
}
