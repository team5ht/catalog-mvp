(function() {
  const AUTH_STORAGE_KEY = 'auth_logged_in';
  const BODY_AUTH_LOGGED_IN = 'auth-logged-in';
  const BODY_AUTH_LOGGED_OUT = 'auth-logged-out';

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
    showToast('Вы вышли из аккаунта.');
  }

  function setBodyAuthState(authed) {
    if (!document.body) return;
    document.body.classList.remove(BODY_AUTH_LOGGED_IN, BODY_AUTH_LOGGED_OUT);
    document.body.classList.add(authed ? BODY_AUTH_LOGGED_IN : BODY_AUTH_LOGGED_OUT);
  }

  function updateAccountState(button) {
    const authed = isAuthenticated();
    setBodyAuthState(authed);
    button.setAttribute('aria-label', authed ? 'Выйти из аккаунта' : 'Профиль');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const accountButton = document.getElementById('nav-account');
    if (!accountButton) {
      return;
    }

    updateAccountState(accountButton);
    accountButton.addEventListener('click', (event) => handleAccountClick(event, accountButton));
  });
})();
