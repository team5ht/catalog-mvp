(function(global) {
  const REDIRECT_STORAGE_KEY = 'authRedirectUrl';
  const AUTH_STORAGE_KEY = 'auth_logged_in';
  const AUTH_SYNC_CHANNEL = 'auth-session-sync';
  let currentSession = null;
  let lastAuthState = null;
  let isSyncing = false;
  let broadcastChannel = null;

  function setLocalAuthFlag(isAuthed) {
    try {
      if (isAuthed) {
        localStorage.setItem(AUTH_STORAGE_KEY, '1');
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('Не удалось обновить состояние авторизации', err);
    }
  }

  function notifyAuthChange(isAuthed, user) {
    if (lastAuthState === isAuthed) {
      return;
    }

    lastAuthState = isAuthed;
    setLocalAuthFlag(isAuthed);

    try {
      global.dispatchEvent(new CustomEvent('authstatechange', {
        detail: { isAuthenticated: isAuthed, user: user || null }
      }));
    } catch (err) {
      console.warn('Не удалось отправить событие authstatechange', err);
    }
  }

  function isAuthenticated() {
    if (currentSession) {
      return true;
    }

    try {
      return Boolean(localStorage.getItem(AUTH_STORAGE_KEY));
    } catch (err) {
      console.warn('Не удалось проверить состояние авторизации', err);
      return false;
    }
  }

  async function refreshSession() {
    if (isSyncing) {
      return currentSession;
    }

    isSyncing = true;

    try {
      if (!global.supabaseClient || !global.supabaseClient.auth) {
        const stored = isAuthenticated();
        currentSession = stored ? (currentSession || { user: null }) : null;
        notifyAuthChange(stored, currentSession ? currentSession.user : null);
        return currentSession;
      }

      const { data, error } = await global.supabaseClient.auth.getSession();
      if (error) {
        console.warn('Ошибка при получении сессии Supabase', error);
      }
      currentSession = data && data.session ? data.session : null;
      notifyAuthChange(Boolean(currentSession), currentSession ? currentSession.user : null);
      return currentSession;
    } catch (err) {
      console.warn('Не удалось обновить сессию авторизации', err);
      return currentSession;
    } finally {
      isSyncing = false;
    }
  }

  async function applyExternalSession(sessionPayload) {
    // Подхватываем токены, пришедшие из другого окна/браузера/воркера, и синхронизируем с Supabase
    if (!sessionPayload || !sessionPayload.access_token || !sessionPayload.refresh_token) {
      return;
    }

    if (currentSession && currentSession.access_token === sessionPayload.access_token) {
      return;
    }

    if (!global.supabaseClient || !global.supabaseClient.auth || typeof global.supabaseClient.auth.setSession !== 'function') {
      return;
    }

    try {
      const { data, error } = await global.supabaseClient.auth.setSession({
        access_token: sessionPayload.access_token,
        refresh_token: sessionPayload.refresh_token
      });
      if (error) {
        console.warn('Не удалось применить внешнюю сессию', error);
        return;
      }
      currentSession = data && data.session ? data.session : null;
      notifyAuthChange(Boolean(currentSession), currentSession ? currentSession.user : null);
    } catch (err) {
      console.warn('Не удалось установить внешнюю сессию', err);
    }
  }

  function setRedirectUrl(url) {
    try {
      if (typeof url === 'string') {
        localStorage.setItem(REDIRECT_STORAGE_KEY, url);
      }
    } catch (err) {
      console.warn('Не удалось сохранить redirect URL', err);
    }
  }

  function getRedirectUrl() {
    try {
      const url = localStorage.getItem(REDIRECT_STORAGE_KEY);
      if (url) {
        localStorage.removeItem(REDIRECT_STORAGE_KEY);
      }
      return url;
    } catch (err) {
      console.warn('Не удалось получить redirect URL', err);
      return null;
    }
  }

  function bindSupabaseAuthListener() {
    if (!global.supabaseClient || !global.supabaseClient.auth || typeof global.supabaseClient.auth.onAuthStateChange !== 'function') {
      return;
    }

    global.supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      notifyAuthChange(Boolean(session), session ? session.user : null);
    });
  }

  function setupCrossContextSync() {
    // Передаём сессию между браузером и установленным PWA через BroadcastChannel
    if ('BroadcastChannel' in global) {
      try {
        broadcastChannel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
        broadcastChannel.addEventListener('message', (event) => {
          const data = event && event.data ? event.data : null;
          if (data && data.type === 'auth-session' && data.session) {
            applyExternalSession(data.session);
          }
        });
      } catch (err) {
        console.warn('Не удалось инициализировать BroadcastChannel', err);
      }
    }

    // И через сервис-воркер, чтобы поймать клики по ссылке из внешнего браузера даже без открытого PWA
    if (global.navigator && global.navigator.serviceWorker) {
      global.navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event && event.data ? event.data : null;
        if (data && data.type === 'auth-session' && data.session) {
          applyExternalSession(data.session);
        }
      });

      global.navigator.serviceWorker.ready
        .then((registration) => {
          if (registration && registration.active) {
            registration.active.postMessage({ type: 'auth-session-request' });
          }
        })
        .catch(() => {
          // Воркер не контролирует страницу или ещё не готов — пропускаем
        });
    }
  }

  function init() {
    bindSupabaseAuthListener();
    setupCrossContextSync();
    refreshSession();
  }

  global.AuthState = {
    isAuthenticated,
    setRedirectUrl,
    getRedirectUrl,
    refreshSession,
    getUser: () => currentSession ? currentSession.user : null
  };

  init();
})(window);
