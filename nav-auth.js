(function() {
  const LOGIN_ICON = '<svg class="bottom-nav__icon" width="25" height="25" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" fill="none" stroke-width="2"/><path d="M4 20c0-4 16-4 16 0" fill="none" stroke-width="2"/></svg>';
  const LOGOUT_ICON = '<svg class="bottom-nav__icon" width="25" height="25" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 16l4-4-4-4" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12h10" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  let currentSession = null;

  function getClient() {
    return typeof window !== 'undefined' ? window.supabaseClient : null;
  }

  function isAuthenticated() {
    return Boolean(currentSession && currentSession.user);
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
    if (!isAuthenticated()) {
      event.preventDefault();
      const currentUrl = window.location.href;
      const loginUrl = `auth-login.html?redirect=${encodeURIComponent(currentUrl)}`;
      window.location.href = loginUrl;
      return;
    }

    event.preventDefault();
    const client = getClient();
    if (client && client.auth && typeof client.auth.signOut === 'function') {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Ошибка при выходе из Supabase', err);
      }
    }
    currentSession = null;
    updateAccountState(button);
    showToast('Вы вышли из аккаунта.');
  }

  function updateAccountState(button) {
    if (!button) {
      return;
    }
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
