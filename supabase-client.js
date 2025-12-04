// Shared Supabase client (CDN-friendly). Configure via publishable key, never embed the secret key in the browser.
(function initSupabaseClient(global) {
  const supabaseUrl =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_SUPABASE_URL) ||
    global.SUPABASE_URL ||
    '';

  const supabasePublishableKey =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    global.SUPABASE_PUBLISHABLE_KEY ||
    '';

  if (global.supabaseClient) {
    return;
  }

  if (!supabaseUrl || !supabasePublishableKey) {
    console.warn(
      'Supabase config is missing. Provide VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (publishable/public key only).'
    );
    global.supabaseClient = null;
    return;
  }

  const { createClient } = global.supabase || {};

  if (typeof createClient === 'function') {
    global.supabaseClient = createClient(supabaseUrl, supabasePublishableKey);
  } else {
    console.warn('Supabase JS SDK is not loaded. Make sure the CDN script is included before supabase-client.js');
    global.supabaseClient = null;
  }
})(window);
