const state = {
  currentRoute: null,
  currentRenderToken: 0,
  catalogUiState: {
    categoryId: 0,
    query: ''
  },
  inAppRouteHistory: []
};

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

export function pushRouteHistory(hash) {
  const lastHash = state.inAppRouteHistory[state.inAppRouteHistory.length - 1];
  if (lastHash !== hash) {
    state.inAppRouteHistory.push(hash);
  }
}

export function canGoBackInApp() {
  return state.inAppRouteHistory.length > 1;
}
