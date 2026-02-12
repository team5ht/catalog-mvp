export function getAuthStore() {
  return window.authStore || null;
}

export function initializeAuthStore() {
  const store = getAuthStore();
  if (store && typeof store.init === 'function') {
    store.init();
  }
  return store;
}

export function getSupabaseClient() {
  const client = window.supabaseClient;
  if (!client || !client.auth) {
    return null;
  }
  return client;
}

export function isAuthenticated() {
  const store = getAuthStore();
  if (!store || typeof store.isAuthenticated !== 'function') {
    return false;
  }
  return store.isAuthenticated();
}

export async function refreshAuthSession(options = {}) {
  const { force = false } = options;
  const store = initializeAuthStore();
  if (!store) {
    return null;
  }

  try {
    if (force && typeof store.refresh === 'function') {
      return await store.refresh();
    }

    if (typeof store.whenReady === 'function') {
      return await store.whenReady();
    }
  } catch (error) {
    console.warn('Не удалось синхронизировать auth-store', error);
  }

  return null;
}

export async function updateUserPassword(client, password) {
  if (!client || !client.auth || typeof client.auth.updateUser !== 'function') {
    return {
      ok: false,
      error: new Error('SUPABASE_CLIENT_UNAVAILABLE')
    };
  }

  try {
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}
