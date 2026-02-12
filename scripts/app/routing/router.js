import {
  AUTH_MODE_RECOVERY,
  HOME_HASH
} from '../constants.js';
import {
  getAuthModeFromRoute,
  buildAuthHash,
  consumeRecoverySearchMarker,
  parseHash
} from './hash.js';
import { navigateTo } from './navigation.js';
import {
  getCurrentRoute,
  isRecoveryFlowActive,
  nextRenderToken,
  pushRouteHistory,
  setCurrentRoute,
  setRecoveryFlowActive
} from '../state.js';
import { applyShellState, updateBottomNavActive } from '../ui/shell.js';
import { renderAuthView } from '../views/auth-view.js';
import { renderCatalogView } from '../views/catalog-view.js';
import { renderHomeView } from '../views/home-view.js';
import { renderMaterialView } from '../views/material-view.js';
import { renderAccountView } from '../views/account-view.js';

export async function applyRoute(route, options = {}) {
  const { skipHistory = false } = options;

  setCurrentRoute(route);
  if (!skipHistory) {
    pushRouteHistory(route.fullHash);
  }

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
  if (consumeRecoverySearchMarker()) {
    const recoveryRoute = parseHash(buildAuthHash(null, { mode: AUTH_MODE_RECOVERY }));
    await applyRoute(recoveryRoute, options);
    return;
  }

  const rawHash = window.location.hash || '';
  if ((!rawHash || rawHash === '#') && isRecoveryFlowActive()) {
    const recoveryRoute = parseHash(buildAuthHash(null, { mode: AUTH_MODE_RECOVERY }));
    await applyRoute(recoveryRoute, options);
    return;
  }

  const route = parseHash(window.location.hash || HOME_HASH);
  if (route.name === 'unknown') {
    if (isRecoveryFlowActive()) {
      const recoveryRoute = parseHash(buildAuthHash(null, { mode: AUTH_MODE_RECOVERY }));
      await applyRoute(recoveryRoute, options);
      return;
    }
    navigateTo(HOME_HASH, { replace: true });
    return;
  }

  const isRecoveryRoute = route.name === 'auth' && getAuthModeFromRoute(route) === AUTH_MODE_RECOVERY;
  if (!isRecoveryRoute) {
    setRecoveryFlowActive(false);
  }

  await applyRoute(route, options);
}

export function getActiveRoute() {
  return getCurrentRoute();
}
