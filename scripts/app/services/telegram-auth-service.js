import { getSupabaseClient } from './auth-service.js';

export const TELEGRAM_WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22';
const DEFAULT_TELEGRAM_AUTH_FUNCTION_URL = 'https://dgdnmenvpkyzdvhtmhmz.supabase.co/functions/v1/telegram-auth';

export function getTelegramAuthConfig() {
  const globalScope = typeof window === 'undefined' ? null : window;
  const botUsername = typeof globalScope?.TELEGRAM_LOGIN_BOT_USERNAME === 'string'
    ? globalScope.TELEGRAM_LOGIN_BOT_USERNAME.trim()
    : '';

  const configuredFunctionUrl = typeof globalScope?.TELEGRAM_AUTH_FUNCTION_URL === 'string'
    ? globalScope.TELEGRAM_AUTH_FUNCTION_URL.trim()
    : '';

  return {
    botUsername,
    functionUrl: configuredFunctionUrl || DEFAULT_TELEGRAM_AUTH_FUNCTION_URL
  };
}

export function mountTelegramWidget(container, botUsername) {
  if (!(container instanceof Element)) {
    return false;
  }

  const normalizedBotUsername = typeof botUsername === 'string' ? botUsername.trim() : '';
  if (!normalizedBotUsername) {
    container.innerHTML = '';
    return false;
  }

  container.innerHTML = '';

  const script = document.createElement('script');
  script.async = true;
  script.src = TELEGRAM_WIDGET_SRC;
  script.setAttribute('data-telegram-login', normalizedBotUsername);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-userpic', 'false');
  script.setAttribute('data-request-access', 'write');
  script.setAttribute('data-onauth', 'onTelegramAuth(user)');

  container.appendChild(script);
  return true;
}

function normalizeErrorMessage(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  const message = typeof error.message === 'string' ? error.message.trim() : '';
  return message || fallbackMessage;
}

export async function authenticateViaTelegram(user) {
  console.log('Telegram payload:', user);

  const config = getTelegramAuthConfig();
  if (!config.functionUrl) {
    throw new Error('TELEGRAM_AUTH_FUNCTION_URL is missing');
  }

  const response = await fetch(config.functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(user)
  });

  let responseData = null;
  try {
    responseData = await response.json();
  } catch (_parseError) {
    responseData = null;
  }

  if (!response.ok) {
    const fallbackError = `telegram-auth request failed with status ${response.status}`;
    const errorMessage = responseData && typeof responseData.error === 'string'
      ? responseData.error
      : fallbackError;
    throw new Error(errorMessage);
  }

  const email = typeof responseData?.email === 'string' ? responseData.email.trim() : '';
  const tokenHash = typeof responseData?.token_hash === 'string' ? responseData.token_hash.trim() : '';
  if (!email || !tokenHash) {
    throw new Error('telegram-auth response is missing email or token_hash');
  }

  const client = getSupabaseClient();
  if (!client || !client.auth || typeof client.auth.verifyOtp !== 'function') {
    throw new Error('SUPABASE_CLIENT_UNAVAILABLE');
  }

  const { error } = await client.auth.verifyOtp({
    email,
    token_hash: tokenHash,
    type: 'magiclink'
  });

  if (error) {
    throw new Error(normalizeErrorMessage(error, 'Supabase verifyOtp failed'));
  }

  return { email, token_hash: tokenHash };
}
