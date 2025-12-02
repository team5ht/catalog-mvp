(function() {
  const AUTH_STORAGE_KEY = 'auth_logged_in';
  const LOGIN_ICON = '<svg class="bottom-nav__icon" width="25" height="25" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" fill="none" stroke-width="2"/><path d="M4 20c0-4 16-4 16 0" fill="none" stroke-width="2"/></svg>';
  const LOGOUT_ICON = '<svg class="bottom-nav__icon" width="25" height="25" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 16l4-4-4-4" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12h10" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function getAuthModule() {
    return typeof window !== 'undefined' ? window.AuthState : null;
  }

  function isAuthenticated() {
    const authModule = getAuthModule();
    if (authModule && typeof authModule.isAuthenticated === 'function') {
      return authModule.isAuthenticated();
    }
    return false;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'auth-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('auth-toast--visible');
    });

    setTimeout(() => {
      toast.classList.remove('auth-toast--visible');
      setTimeout(() => toast.remove(), 250);
    }, 2000);
  }

  function handleAccountClick(event, button) {
    if (!isAuthenticated()) {
      event.preventDefault();
      const currentUrl = window.location.pathname + window.location.search;
      const loginUrl = `auth-login.html?redirect=${encodeURIComponent(currentUrl)}`;
      window.location.href = loginUrl;
      return;
    }

    event.preventDefault();
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (err) {
      console.warn('Не удалось удалить состояние авторизации', err);
    }
    updateAccountState(button);
    window.dispatchEvent(new CustomEvent('authstatechange', {
      detail: { isAuthenticated: false }
    }));
    showToast('Вы вышли из аккаунта.');
  }

  function updateAccountState(button) {
    const authed = isAuthenticated();
    button.innerHTML = authed ? LOGOUT_ICON : LOGIN_ICON;
    button.setAttribute('aria-label', authed ? 'Выйти из аккаунта' : 'Войти');
    button.classList.remove('is-loading');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const accountButton = document.getElementById('nav-account');
    if (!accountButton) {
      return;
    }

    updateAccountState(accountButton);
    window.dispatchEvent(new CustomEvent('authstatechange', {
      detail: { isAuthenticated: isAuthenticated() }
    }));
    accountButton.addEventListener('click', (event) => handleAccountClick(event, accountButton));
  });
})();
