import { HOME_HASH } from '../constants.js';
import { parseHash } from './hash.js';
import { navigateTo } from './navigation.js';
import {
  getCurrentRoute,
  nextRenderToken,
  recordRouteVisit,
  setCurrentRoute
} from '../state.js';
import { applyShellState, updateBottomNavActive } from '../ui/shell.js';
import { renderAuthView } from '../views/auth-view.js';
import { renderCatalogView } from '../views/catalog-view.js';
import { renderHomeView } from '../views/home-view.js';
import { renderMaterialView } from '../views/material-view.js';
import { renderAccountView } from '../views/account-view.js';

function applyScrollPolicy(navigationType) {
  if (
    navigationType === 'initial'
    || navigationType === 'push'
    || navigationType === 'replace'
  ) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
}

export async function applyRoute(route, options = {}) {
  const { skipHistory = false, historyMode = 'auto' } = options;

  setCurrentRoute(route);
  let navigationType = 'noop';
  if (!skipHistory) {
    navigationType = recordRouteVisit(route.fullHash, historyMode);
  }
  applyScrollPolicy(navigationType);

  const renderToken = nextRenderToken();

  applyShellState(route.name);
  updateBottomNavActive(route.name);

  if (route.name === 'home') {
    renderHomeView(renderToken);
    return;
  }

  if (route.name === 'catalog') {
    renderCatalogView(renderToken);
    return;
  }

  if (route.name === 'material') {
    await renderMaterialView(route, renderToken);
    return;
  }

  if (route.name === 'auth') {
    await renderAuthView(route, renderToken);
    return;
  }

  if (route.name === 'account') {
    await renderAccountView(renderToken);
    return;
  }

  navigateTo(HOME_HASH, { replace: true });
}

export async function processCurrentHash(options = {}) {
  const route = parseHash(window.location.hash || HOME_HASH);
  if (route.name === 'unknown') {
    navigateTo(HOME_HASH, { replace: true });
    return;
  }

  await applyRoute(route, options);
}

export function getActiveRoute() {
  return getCurrentRoute();
}
