// Shared Supabase client (CDN-friendly). Configure via publishable key, never embed the secret key in the browser.
(function initSupabaseClient(global) {
  // Берём значения ТОЛЬКО из window.*, потому что у нас чистый статический фронт без сборщика.
  const supabaseUrl = global.SUPABASE_URL || '';
  const supabasePublishableKey = global.SUPABASE_PUBLISHABLE_KEY || '';

  // Если клиент уже инициализирован — ничего не делаем
  if (global.supabaseClient) {
    return;
  }

  if (!supabaseUrl || !supabasePublishableKey) {
    console.warn(
      'Supabase config is missing. Set window.SUPABASE_URL and window.SUPABASE_PUBLISHABLE_KEY before loading supabase-client.js.'
    );
    global.supabaseClient = null;
    return;
  }

  const sdk = global.supabase;
  if (!sdk || typeof sdk.createClient !== 'function') {
    console.warn('Supabase JS SDK is not loaded. Make sure the CDN script is included before supabase-client.js');
    global.supabaseClient = null;
    return;
  }

  global.supabaseClient = sdk.createClient(supabaseUrl, supabasePublishableKey);
})(window);
