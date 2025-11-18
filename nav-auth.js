(function() {
  const AUTH_STORAGE_KEY = 'auth_logged_in';

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

  function setRootAuthClass(authed) {
    const root = document.documentElement;
    if (!root) {
      return;
    }
    root.classList.remove('auth-logged-in', 'auth-logged-out');
    root.classList.add(authed ? 'auth-logged-in' : 'auth-logged-out');
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

  function updateAccountState(button) {
    const authed = isAuthenticated();
    setRootAuthClass(authed);
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
