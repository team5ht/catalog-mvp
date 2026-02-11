(function initAuthStore(global) {
  if (!global || global.authStore) {
    return;
  }

  let session = null;
  let ready = false;
  let initPromise = null;
  let authSubscription = null;
  let lastEvent = 'INIT';

  const listeners = new Set();

  function getClient() {
    const client = global.supabaseClient;
    if (!client || !client.auth) {
      return null;
    }
    return client;
  }

  function buildState(eventName) {
    return {
      event: eventName || lastEvent,
      session,
      isAuthenticated: Boolean(session && session.user)
    };
  }

  function notify(eventName) {
    lastEvent = eventName || lastEvent;
    const state = buildState(lastEvent);

    listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.warn('Auth store subscriber failed', error);
      }
    });
  }

  async function syncSession(eventName, client) {
    if (!client || typeof client.auth.getSession !== 'function') {
      session = null;
      ready = true;
      notify(eventName || 'NO_CLIENT');
      return session;
    }

    try {
      const { data } = await client.auth.getSession();
      session = data ? data.session : null;
    } catch (error) {
      console.warn('Не удалось получить сессию Supabase', error);
      session = null;
    }

    ready = true;
    notify(eventName || 'SYNC');
    return session;
  }

  function bindAuthSubscription(client) {
    if (!client || typeof client.auth.onAuthStateChange !== 'function' || authSubscription) {
      return;
    }

    const result = client.auth.onAuthStateChange((event, nextSession) => {
      session = nextSession || null;
      ready = true;
      notify(event || 'AUTH_STATE_CHANGE');
    });

    const subscription = result && result.data ? result.data.subscription : null;
    if (subscription && typeof subscription.unsubscribe === 'function') {
      authSubscription = subscription;
    }
  }

  function init() {
    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      const client = getClient();
      if (!client) {
        ready = true;
        session = null;
        notify('NO_CLIENT');
        return session;
      }

      bindAuthSubscription(client);
      return syncSession('INITIAL_SESSION', client);
    })();

    return initPromise;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSession() {
    return session;
  }

  function isAuthenticated() {
    return Boolean(session && session.user);
  }

  function whenReady() {
    if (ready) {
      return Promise.resolve(session);
    }

    return init().then(() => session);
  }

  async function refresh() {
    const client = getClient();
    if (!client) {
      ready = true;
      session = null;
      notify('NO_CLIENT');
      return session;
    }

    bindAuthSubscription(client);
    return syncSession('MANUAL_REFRESH', client);
  }

  global.authStore = {
    init,
    subscribe,
    getSession,
    isAuthenticated,
    whenReady,
    refresh
  };
})(window);
