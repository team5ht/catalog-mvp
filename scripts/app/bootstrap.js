import {
  AUTH_MODE_LOGIN,
  HOME_HASH
} from './constants.js';
import {
  buildAuthHash,
  getAuthModeFromRoute,
  sanitizeRedirectHash
} from './routing/hash.js';
import { setReplaceNavigationHandler, navigateTo } from './routing/navigation.js';
import { processCurrentHash, getActiveRoute } from './routing/router.js';
import { initializeAuthStore } from './services/auth-service.js';
import { bindStaticNav } from './ui/shell.js';
import { renderDownloadButtonState } from './views/material-view.js';
import { registerOrientationGuard } from './platform/orientation-guard.js';
import { registerServiceWorker } from './platform/service-worker-registration.js';

function syncMaterialDownloadCta() {
  const currentRoute = getActiveRoute();
  if (!currentRoute || currentRoute.name !== 'material') {
    return;
  }

  const downloadButton = document.getElementById('downloadBtn');
  if (downloadButton) {
    renderDownloadButtonState(downloadButton);
  }
}

function registerAuthListener() {
  const store = initializeAuthStore();
  if (!store || typeof store.subscribe !== 'function') {
    return;
  }

  store.subscribe((state) => {
    const authed = Boolean(state && state.isAuthenticated);

    syncMaterialDownloadCta();

    const currentRoute = getActiveRoute();
    if (!currentRoute) {
      return;
    }

    if (currentRoute.name === 'auth' && authed) {
      const authMode = getAuthModeFromRoute(currentRoute);
      if (authMode !== AUTH_MODE_LOGIN) {
        return;
      }
      const redirectHash = sanitizeRedirectHash(currentRoute.query.redirect) || HOME_HASH;
      navigateTo(redirectHash, { replace: true });
      return;
    }

    if (currentRoute.name === 'account' && !authed) {
      navigateTo(buildAuthHash('#/account'), { replace: true });
    }
  });
}

function init() {
  bindStaticNav();
  registerAuthListener();
  registerOrientationGuard();
  registerServiceWorker();

  setReplaceNavigationHandler(() => processCurrentHash());

  window.addEventListener('hashchange', () => {
    void processCurrentHash();
  });

  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = HOME_HASH;
  }

  void processCurrentHash();
}

export function initApp() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
