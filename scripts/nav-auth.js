(function() {
  const UNAUTHORIZED_ICON_REF = 'assets/icons/sprite.svg#icon-unauthorised';
  const AUTHORIZED_ICON_REF = 'assets/icons/sprite.svg#icon-authorised';
  const UNAUTHORIZED_LABEL = 'Войти';
  const AUTHORIZED_LABEL = 'Профиль';
  const STATE_CHANGE_CLASS = 'is-state-changing';
  const STATE_CHANGE_DURATION_MS = 160;
  const STATE_CHANGE_SWITCH_DELAY_MS = Math.round(STATE_CHANGE_DURATION_MS * 0.5);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';

  function getAuthStore() {
    return typeof window !== 'undefined' ? window.authStore || null : null;
  }

  function initAuthStore() {
    const store = getAuthStore();
    if (store && typeof store.init === 'function') {
      store.init();
    }
    return store;
  }

  function isAuthenticated() {
    const store = getAuthStore();
    if (!store || typeof store.isAuthenticated !== 'function') {
      return false;
    }
    return store.isAuthenticated();
  }

  function normalizeHashRoute(hash) {
    if (!hash || hash === '#') {
      return '#/';
    }

    if (hash.startsWith('#/')) {
      return hash;
    }

    return '#/';
  }

  function getCurrentHashRoute() {
    return normalizeHashRoute(window.location.hash);
  }

  function buildAuthHash(redirectHash) {
    const params = new URLSearchParams();
    const safeRedirect = normalizeHashRoute(redirectHash);
    params.set('redirect', safeRedirect);
    return `#/auth?${params.toString()}`;
  }

  async function waitForAuthReady() {
    const store = initAuthStore();
    if (!store || typeof store.whenReady !== 'function') {
      return null;
    }

    try {
      return await store.whenReady();
    } catch (_error) {
      return null;
    }
  }

  async function handleAccountClick(event, button) {
    if (button && button.classList.contains('is-loading')) {
      await waitForAuthReady();
      updateAccountState(button);
    }

    if (!isAuthenticated()) {
      event.preventDefault();
      window.location.hash = buildAuthHash(getCurrentHashRoute());
      return;
    }

    event.preventDefault();
    window.location.hash = '#/account';
  }

  function setUseHref(useNode, href) {
    useNode.setAttribute('href', href);
    useNode.setAttributeNS(XLINK_NS, 'xlink:href', href);
  }

  function getUseHref(useNode) {
    return useNode.getAttribute('href') || useNode.getAttributeNS(XLINK_NS, 'href') || '';
  }

  function prefersReducedMotion() {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function ensureAccountIcon(button) {
    let icon = button.querySelector('svg.bottom-nav__icon');
    if (!icon) {
      icon = document.createElementNS(SVG_NS, 'svg');
      icon.setAttribute('class', 'bottom-nav__icon');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
      button.appendChild(icon);
    }

    let useNode = icon.querySelector('use');
    if (!useNode) {
      useNode = document.createElementNS(SVG_NS, 'use');
      icon.appendChild(useNode);
    }

    return useNode;
  }

  function ensureAccountLabel(button) {
    let label = button.querySelector('.bottom-nav__label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'bottom-nav__label';
      label.textContent = UNAUTHORIZED_LABEL;
      button.appendChild(label);
    }
    return label;
  }

  function applyAccountButtonState(button, iconRef, labelText, ariaLabel) {
    const useNode = ensureAccountIcon(button);
    const label = ensureAccountLabel(button);
    setUseHref(useNode, iconRef);
    label.textContent = labelText;
    button.setAttribute('aria-label', ariaLabel);
  }

  function updateAccountState(button) {
    if (!button) {
      return;
    }

    if (button._navAccountTransitionTimeout) {
      clearTimeout(button._navAccountTransitionTimeout);
      button._navAccountTransitionTimeout = null;
      button.classList.remove(STATE_CHANGE_CLASS);
    }

    const authed = isAuthenticated();
    const nextIconRef = authed ? AUTHORIZED_ICON_REF : UNAUTHORIZED_ICON_REF;
    const nextLabel = authed ? AUTHORIZED_LABEL : UNAUTHORIZED_LABEL;
    const nextAriaLabel = nextLabel;

    const useNode = ensureAccountIcon(button);
    const label = ensureAccountLabel(button);
    const currentIconRef = getUseHref(useNode);
    const currentLabel = (label.textContent || '').trim();

    const shouldAnimate = !button.classList.contains('is-loading') &&
      !prefersReducedMotion() &&
      (currentIconRef !== nextIconRef || currentLabel !== nextLabel);

    if (shouldAnimate) {
      button.classList.add(STATE_CHANGE_CLASS);
      button._navAccountTransitionTimeout = window.setTimeout(() => {
        applyAccountButtonState(button, nextIconRef, nextLabel, nextAriaLabel);
        requestAnimationFrame(() => {
          button.classList.remove(STATE_CHANGE_CLASS);
        });
        button._navAccountTransitionTimeout = null;
      }, STATE_CHANGE_SWITCH_DELAY_MS);
    } else {
      applyAccountButtonState(button, nextIconRef, nextLabel, nextAriaLabel);
    }

    button.classList.remove('is-loading');
  }

  function subscribeToAuthState(accountButton) {
    const store = getAuthStore();
    if (!store || typeof store.subscribe !== 'function') {
      return () => {};
    }

    return store.subscribe(() => {
      updateAccountState(accountButton);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const accountButton = document.getElementById('nav-account');
    if (!accountButton) {
      return;
    }

    initAuthStore();
    const unsubscribe = subscribeToAuthState(accountButton);

    void waitForAuthReady().finally(() => {
      updateAccountState(accountButton);
    });

    accountButton.addEventListener('click', (event) => handleAccountClick(event, accountButton));

    window.addEventListener('beforeunload', () => {
      unsubscribe();
    }, { once: true });
  });
})();
