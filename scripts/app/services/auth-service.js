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

function buildCaptchaOptions(options = {}) {
  const captchaToken = typeof options.captchaToken === 'string' ? options.captchaToken.trim() : '';
  return captchaToken ? { captchaToken } : null;
}

export async function loginWithPassword(email, password) {
  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.signInWithPassword !== 'function') {
    return {
      ok: false,
      error: new Error('SUPABASE_CLIENT_UNAVAILABLE'),
      session: null,
      user: null
    };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
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

export async function requestSignupOtp(email, options = {}) {
  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.signInWithOtp !== 'function') {
    return {
      ok: false,
      error: new Error('SUPABASE_CLIENT_UNAVAILABLE')
    };
  }

  const captchaOptions = buildCaptchaOptions(options);
  const requestParams = {
    email,
    options: {
      shouldCreateUser: true
    }
  };

  if (captchaOptions) {
    requestParams.options = {
      ...requestParams.options,
      ...captchaOptions
    };
  }

  try {
    const { error } = await client.auth.signInWithOtp(requestParams);
    if (error) {
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function requestResetOtp(email, options = {}) {
  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.resetPasswordForEmail !== 'function') {
    return {
      ok: false,
      error: new Error('SUPABASE_CLIENT_UNAVAILABLE')
    };
  }

  const captchaOptions = buildCaptchaOptions(options) || {};

  try {
    const { error } = await client.auth.resetPasswordForEmail(email, captchaOptions);
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
  const captchaOptions = buildCaptchaOptions(params);
  const verifyParams = {
    email,
    token,
    type: 'email'
  };

  if (captchaOptions) {
    verifyParams.options = captchaOptions;
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

export async function verifyResetOtp(params = {}) {
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
  const captchaOptions = buildCaptchaOptions(params);
  const verifyParams = {
    email,
    token,
    type: 'recovery'
  };

  if (captchaOptions) {
    verifyParams.options = captchaOptions;
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

export async function updateUserPassword(clientOrPassword, maybePassword) {
  let client = null;
  let password = '';

  if (typeof clientOrPassword === 'string') {
    client = getSupabaseClient();
    password = clientOrPassword;
  } else {
    client = clientOrPassword || getSupabaseClient();
    password = typeof maybePassword === 'string' ? maybePassword : '';
  }

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

export async function signOutCurrentUser() {
  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.signOut !== 'function') {
    return {
      ok: false,
      error: new Error('SUPABASE_CLIENT_UNAVAILABLE')
    };
  }

  try {
    const { error } = await client.auth.signOut();
    if (error) {
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}
