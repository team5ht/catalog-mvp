const { test, expect } = require('@playwright/test');

const TELEGRAM_AUTH_FUNCTION_URL = 'https://dgdnmenvpkyzdvhtmhmz.supabase.co/functions/v1/telegram-auth';
const DEFAULT_WIDGET_USER = {
  id: 123456789,
  first_name: 'Test',
  username: 'tg_test_user',
  photo_url: 'https://t.me/i/userpic/320/test.jpg',
  auth_date: 1730000000,
  hash: 'telegram_hash_signature'
};

const MOCK_SUPABASE_CDN_SCRIPT = `
(() => {
  const scenario = window.__TELEGRAM_TEST_SCENARIO || {};
  const listeners = new Set();
  let session = null;

  function createError(data) {
    return {
      message: data && data.message ? data.message : 'Mock auth error',
      status: data && data.status ? data.status : 400,
      code: data && data.code ? data.code : 'mock_error'
    };
  }

  function emit(event, nextSession) {
    session = nextSession || null;
    listeners.forEach((listener) => {
      try {
        listener(event, session);
      } catch (_error) {
        // ignore listener errors in test mock
      }
    });
  }

  const auth = {
    async getSession() {
      return { data: { session } };
    },
    onAuthStateChange(callback) {
      listeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback);
            }
          }
        }
      };
    },
    async signInWithPassword() {
      return { data: null, error: createError({ message: 'Mock sign-in disabled' }) };
    },
    async signInWithOtp() {
      return { data: {}, error: null };
    },
    async resetPasswordForEmail() {
      return { data: {}, error: null };
    },
    async verifyOtp(params) {
      window.__TELEGRAM_TEST_CALLS = window.__TELEGRAM_TEST_CALLS || [];
      window.__TELEGRAM_TEST_CALLS.push({ method: 'verifyOtp', params });

      if (params && (params.type === 'magiclink' || params.type === 'signup')) {
        const shouldFail = (
          (params.type === 'magiclink' && scenario.verifyMagiclink === 'fail')
          || (params.type === 'signup' && scenario.verifySignup === 'fail')
        );

        if (shouldFail) {
          return {
            data: null,
            error: createError({ message: 'Email verify failed', code: 'invalid_grant' })
          };
        }

        const nextSession = {
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'mock-user-id',
            email: params.email || 'telegram@example.com',
            app_metadata: {
              verification_type: params.type
            }
          }
        };
        emit('SIGNED_IN', nextSession);

        return {
          data: {
            session: nextSession,
            user: nextSession.user
          },
          error: null
        };
      }

      return {
        data: {
          session,
          user: session ? session.user : null
        },
        error: null
      };
    },
    async updateUser() {
      return { data: { user: session ? session.user : null }, error: null };
    },
    async signOut() {
      emit('SIGNED_OUT', null);
      return { error: null };
    }
  };

  window.supabase = {
    createClient() {
      return { auth };
    }
  };
})();
`;

const MOCK_TELEGRAM_WIDGET_SCRIPT = `
(() => {
  const script = document.currentScript;
  const container = script && script.parentElement;
  if (!container) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mock-telegram-widget-button';
  button.textContent = 'Telegram Login';
  button.addEventListener('click', () => {
    const scenario = window.__TELEGRAM_TEST_SCENARIO || {};
    const user = scenario.widgetUser || {};
    if (typeof window.onTelegramAuth === 'function') {
      void window.onTelegramAuth(user);
    }
  });

  container.appendChild(button);
})();
`;

async function setupTelegramMocks(page, options = {}) {
  const {
    botUsername = 'the5htbot',
    functionUrl = TELEGRAM_AUTH_FUNCTION_URL,
    widgetUser = DEFAULT_WIDGET_USER,
    functionStatus = 200,
    functionResponse = {
      email: 'telegram@example.com',
      token_hash: 'mock_token_hash',
      verification_type: 'magiclink'
    },
    verifyMagiclink = 'success',
    verifySignup = 'success'
  } = options;

  const functionRequests = [];

  await page.addInitScript((scenario) => {
    window.__TELEGRAM_TEST_SCENARIO = scenario;
    window.__TELEGRAM_TEST_CALLS = [];
  }, { widgetUser, verifyMagiclink, verifySignup });

  await page.route('**/supabase-config.js', (route) => {
    const body = `
window.SUPABASE_URL = "https://dgdnmenvpkyzdvhtmhmz.supabase.co";
window.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_key";
window.TELEGRAM_LOGIN_BOT_USERNAME = ${JSON.stringify(botUsername)};
window.TELEGRAM_AUTH_FUNCTION_URL = ${JSON.stringify(functionUrl)};
`;

    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body
    });
  });

  await page.route('**/@supabase/supabase-js@2*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: MOCK_SUPABASE_CDN_SCRIPT
    });
  });

  await page.route('**/telegram-widget.js?22*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: MOCK_TELEGRAM_WIDGET_SCRIPT
    });
  });

  await page.route('**/functions/v1/telegram-auth', async (route) => {
    const request = route.request();
    const requestMethod = request.method().toUpperCase();
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization'
    };

    if (requestMethod === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: corsHeaders,
        body: ''
      });
      return;
    }

    const headers = request.headers();
    let body = null;

    try {
      body = request.postDataJSON();
    } catch (_error) {
      body = request.postData();
    }

    if (requestMethod === 'POST') {
      functionRequests.push({ headers, body });
    }

    await route.fulfill({
      status: functionStatus,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(functionResponse)
    });
  });

  return { functionRequests };
}

async function expectControlHeight(locator, expectedHeight = 40) {
  await expect(locator).toBeVisible();

  const height = await locator.evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(height - expectedHeight)).toBeLessThanOrEqual(0.75);
}

test('login telegram auth sends raw payload, verifies edge-provided type and redirects to account', async ({ page }) => {
  const widgetUser = {
    ...DEFAULT_WIDGET_USER,
    id: 700000001,
    username: 'payload_user'
  };
  const functionResponse = {
    email: 'payload@example.com',
    token_hash: 'hash_from_edge_function',
    verification_type: 'magiclink'
  };
  const { functionRequests } = await setupTelegramMocks(page, {
    widgetUser,
    functionResponse
  });

  await page.goto('/#/auth');

  const scriptAttributes = await page.evaluate(() => {
    const script = document.querySelector('#authTelegramLoginWidget script[src="https://telegram.org/js/telegram-widget.js?22"]');
    if (!script) {
      return null;
    }

    return {
      telegramLogin: script.getAttribute('data-telegram-login'),
      size: script.getAttribute('data-size'),
      radius: script.getAttribute('data-radius'),
      width: script.getAttribute('data-width'),
      minWidth: script.getAttribute('data-min-width'),
      maxWidth: script.getAttribute('data-max-width'),
      userpic: script.getAttribute('data-userpic'),
      requestAccess: script.getAttribute('data-request-access'),
      onauth: script.getAttribute('data-onauth')
    };
  });

  expect(scriptAttributes).toMatchObject({
    telegramLogin: 'the5htbot',
    size: 'large',
    radius: '12',
    width: '100%',
    userpic: 'false'
  });
  const primaryButtonWidth = await page.evaluate(() => {
    const primaryButton = document.querySelector('#authForm .button.button--primary');
    if (!(primaryButton instanceof Element)) {
      return 0;
    }

    return Math.round(primaryButton.getBoundingClientRect().width);
  });
  expect(primaryButtonWidth).toBeGreaterThan(0);
  expect(Number(scriptAttributes.minWidth)).toBe(primaryButtonWidth);
  expect(Number(scriptAttributes.minWidth)).toBeGreaterThan(0);
  expect(scriptAttributes.maxWidth).toBe(scriptAttributes.minWidth);
  expect(scriptAttributes.requestAccess).toBe('write');
  expect(scriptAttributes.onauth).toBe('onTelegramAuth(user)');
  await expectControlHeight(page.locator('.mock-telegram-widget-button').first());

  await page.locator('.mock-telegram-widget-button').first().click();

  await expect(page).toHaveURL(/#\/account/);
  expect(functionRequests).toHaveLength(1);
  expect(functionRequests[0].body).toEqual(widgetUser);
  expect(functionRequests[0].headers.authorization).toBeUndefined();

  const verifyParams = await page.evaluate(() => {
    const calls = window.__TELEGRAM_TEST_CALLS || [];
    const call = calls.find((entry) => entry.method === 'verifyOtp' && entry.params && entry.params.type === 'magiclink');
    return call ? call.params : null;
  });

  expect(verifyParams).toEqual({
    token_hash: functionResponse.token_hash,
    type: 'magiclink'
  });
});

test('telegram first-login verifies signup token type from edge response', async ({ page }) => {
  const functionResponse = {
    email: 'first-login@example.com',
    token_hash: 'first_login_hash',
    verification_type: 'signup'
  };
  await setupTelegramMocks(page, { functionResponse });

  await page.goto('/#/auth');
  await page.locator('.mock-telegram-widget-button').first().click();

  await expect(page).toHaveURL(/#\/account/);

  const verifyParams = await page.evaluate(() => {
    const calls = window.__TELEGRAM_TEST_CALLS || [];
    const call = calls.find((entry) => entry.method === 'verifyOtp');
    return call ? call.params : null;
  });

  expect(verifyParams).toEqual({
    token_hash: functionResponse.token_hash,
    type: 'signup'
  });
});

test('signup mode shows telegram widget only on stage 1', async ({ page }) => {
  await setupTelegramMocks(page);

  await page.goto('/#/auth?mode=signup');

  await expect(page.locator('#authTelegramSignupSection')).toBeVisible();
  await expectControlHeight(page.locator('#authTelegramSignupSection .mock-telegram-widget-button').first());

  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('button[data-action="request_signup_otp"]').click();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');
  await expect(page.locator('#authTelegramSignupSection')).toHaveCount(0);
});

test('telegram edge function error shows status and does not call verifyOtp', async ({ page }) => {
  await setupTelegramMocks(page, {
    functionStatus: 400,
    functionResponse: {
      error: 'Telegram signature is invalid'
    }
  });

  await page.goto('/#/auth');

  await page.locator('.mock-telegram-widget-button').first().click();

  await expect(page.locator('#authStatus')).toContainText('Не удалось войти через Telegram');

  const verifyCalls = await page.evaluate(() => {
    const calls = window.__TELEGRAM_TEST_CALLS || [];
    return calls.filter((entry) => entry.method === 'verifyOtp').length;
  });
  expect(verifyCalls).toBe(0);
});

test('unsupported verification_type shows error and skips verifyOtp', async ({ page }) => {
  await setupTelegramMocks(page, {
    functionResponse: {
      email: 'payload@example.com',
      token_hash: 'hash_from_edge_function',
      verification_type: 'invite'
    }
  });

  await page.goto('/#/auth');
  await page.locator('.mock-telegram-widget-button').first().click();

  await expect(page.locator('#authStatus')).toContainText('Не удалось войти через Telegram');
  await expect(page.locator('#authStatus')).toContainText('unsupported verification_type');

  const verifyCalls = await page.evaluate(() => {
    const calls = window.__TELEGRAM_TEST_CALLS || [];
    return calls.filter((entry) => entry.method === 'verifyOtp').length;
  });
  expect(verifyCalls).toBe(0);
});

test('empty telegram bot config hides widget and skips script mount', async ({ page }) => {
  await setupTelegramMocks(page, {
    botUsername: ''
  });

  await page.goto('/#/auth');

  await expect(page.locator('#authTelegramLoginSection')).toBeHidden();
  await expect(page.locator('#authTelegramLoginWidget script')).toHaveCount(0);
  await expect(page.locator('.mock-telegram-widget-button')).toHaveCount(0);
});
