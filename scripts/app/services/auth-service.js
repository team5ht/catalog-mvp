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

export async function requestPasswordResetOtp(email, options = {}) {
  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.resetPasswordForEmail !== 'function') {
    return {
      ok: false,
      error: new Error('SUPABASE_CLIENT_UNAVAILABLE')
    };
  }

  const captchaToken = typeof options.captchaToken === 'string' ? options.captchaToken.trim() : '';
  const requestOptions = captchaToken ? { captchaToken } : {};

  try {
    const { error } = await client.auth.resetPasswordForEmail(email, requestOptions);
    if (error) {
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function requestSignupOtp(email, options = {}) {
  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.signInWithOtp !== 'function') {
    return {
      ok: false,
      error: new Error('SUPABASE_CLIENT_UNAVAILABLE')
    };
  }

  const captchaToken = typeof options.captchaToken === 'string' ? options.captchaToken.trim() : '';
  const otpOptions = {
    shouldCreateUser: true
  };

  if (captchaToken) {
    otpOptions.captchaToken = captchaToken;
  }

  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: otpOptions
    });
    if (error) {
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function verifySignupOtp(params = {}) {
  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.verifyOtp !== 'function') {
    return {
      ok: false,
      error: new Error('SUPABASE_CLIENT_UNAVAILABLE'),
      session: null,
      user: null
    };
  }

  const email = typeof params.email === 'string' ? params.email.trim() : '';
  const token = typeof params.token === 'string' ? params.token.trim() : '';
  const captchaToken = typeof params.captchaToken === 'string' ? params.captchaToken.trim() : '';
  const verifyParams = {
    email,
    token,
    type: 'email'
  };

  if (captchaToken) {
    verifyParams.options = { captchaToken };
  }

  try {
    const { data, error } = await client.auth.verifyOtp(verifyParams);
    if (error) {
      return {
        ok: false,
        error,
        session: null,
        user: null
      };
    }

    return {
      ok: true,
      error: null,
      session: data ? data.session : null,
      user: data ? data.user : null
    };
  } catch (error) {
    return {
      ok: false,
      error,
      session: null,
      user: null
    };
  }
}

export async function verifyPasswordResetOtp(params = {}) {
  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.verifyOtp !== 'function') {
    return {
      ok: false,
      error: new Error('SUPABASE_CLIENT_UNAVAILABLE'),
      session: null,
      user: null
    };
  }

  const email = typeof params.email === 'string' ? params.email.trim() : '';
  const token = typeof params.token === 'string' ? params.token.trim() : '';
  const captchaToken = typeof params.captchaToken === 'string' ? params.captchaToken.trim() : '';
  const verifyParams = {
    email,
    token,
    type: 'recovery'
  };

  if (captchaToken) {
    verifyParams.options = { captchaToken };
  }

  try {
    const { data, error } = await client.auth.verifyOtp(verifyParams);
    if (error) {
      return {
        ok: false,
        error,
        session: null,
        user: null
      };
    }

    return {
      ok: true,
      error: null,
      session: data ? data.session : null,
      user: data ? data.user : null
    };
  } catch (error) {
    return {
      ok: false,
      error,
      session: null,
      user: null
    };
  }
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
