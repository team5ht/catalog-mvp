(function() {
  const UNAUTHORIZED_ICON_REF = 'assets/icons/sprite.svg#icon-unauthorised';
  const AUTHORIZED_ICON_REF = 'assets/icons/sprite.svg#icon-authorised';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';

  let currentSession = null;

  function getClient() {
    return typeof window !== 'undefined' ? window.supabaseClient : null;
  }

  function isAuthenticated() {
    return Boolean(currentSession && currentSession.user);
  }

  async function refreshSession() {
    const client = getClient();
    if (!client || !client.auth || typeof client.auth.getSession !== 'function') {
      currentSession = null;
      return currentSession;
    }
    try {
      const { data } = await client.auth.getSession();
      currentSession = data ? data.session : null;
    } catch (err) {
      console.warn('Не удалось получить сессию Supabase', err);
      currentSession = null;
    }
    return currentSession;
  }

  async function handleAccountClick(event, button) {
    if (button && button.classList.contains('is-loading')) {
      await refreshSession();
      updateAccountState(button);
    }

    if (!isAuthenticated()) {
      event.preventDefault();
      const currentUrl = window.location.href;
      const loginUrl = `auth-login.html?redirect=${encodeURIComponent(currentUrl)}`;
      window.location.href = loginUrl;
      return;
    }

    event.preventDefault();
    window.location.href = 'account.html';
  }

  function setUseHref(useNode, href) {
    useNode.setAttribute('href', href);
    useNode.setAttributeNS(XLINK_NS, 'xlink:href', href);
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

  function updateAccountState(button) {
    if (!button) {
      return;
    }
    const authed = isAuthenticated();
    const useNode = ensureAccountIcon(button);
    setUseHref(useNode, authed ? AUTHORIZED_ICON_REF : UNAUTHORIZED_ICON_REF);
    button.setAttribute('aria-label', authed ? 'Открыть профиль' : 'Войти');
    button.classList.remove('is-loading');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const accountButton = document.getElementById('nav-account');
    if (!accountButton) {
      return;
    }

    refreshSession().finally(() => updateAccountState(accountButton));

    const client = getClient();
    if (client && client.auth && typeof client.auth.onAuthStateChange === 'function') {
      client.auth.onAuthStateChange((_event, session) => {
        currentSession = session;
        updateAccountState(accountButton);
      });
    }

    accountButton.addEventListener('click', (event) => handleAccountClick(event, accountButton));
  });
})();
