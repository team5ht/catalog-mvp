const { test, expect } = require('@playwright/test');

const MOCK_SUPABASE_CDN_SCRIPT = `
(() => {
  const scenario = window.__SIGNUP_TEST_SCENARIO || {};
  const listeners = new Set();
  let session = scenario.authenticated
    ? {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'mock-user-id',
          email: 'user@example.com'
        }
      }
    : null;

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
    async signUp() {
      return { error: null, data: { user: null, session: null } };
    },
    async signInWithPassword() {
      return { error: createError({ message: 'Mock sign-in disabled' }), data: null };
    },
    async signInWithOtp(payload) {
      window.__SIGNUP_TEST_CALLS = window.__SIGNUP_TEST_CALLS || [];
      window.__SIGNUP_TEST_CALLS.push({ method: 'signInWithOtp', payload });

      if (scenario.signInWithOtp === 'rate_limit') {
        return {
          data: null,
          error: createError({
            status: 429,
            code: 'over_email_send_rate_limit',
            message: 'Only request this after 41 seconds'
          })
        };
      }

      if (scenario.signInWithOtp === 'fail') {
        return {
          data: null,
          error: createError({ message: 'OTP request failed' })
        };
      }

      return { data: { user: null, session: null }, error: null };
    },
    async resetPasswordForEmail() {
      return { data: {}, error: null };
    },
    async verifyOtp(params) {
      window.__SIGNUP_TEST_CALLS = window.__SIGNUP_TEST_CALLS || [];
      window.__SIGNUP_TEST_CALLS.push({ method: 'verifyOtp', params });

      if (scenario.verifyOtp === 'rate_limit') {
        return {
          data: null,
          error: createError({
            status: 429,
            code: 'over_email_send_rate_limit',
            message: 'Only request this after 37 seconds'
          })
        };
      }

      if (scenario.verifyOtp === 'invalid') {
        return {
          data: null,
          error: createError({
            status: 400,
            code: 'otp_expired',
            message: 'OTP expired'
          })
        };
      }

      const nextSession = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'mock-user-id',
          email: params.email
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
    },
    async updateUser(payload) {
      window.__SIGNUP_TEST_CALLS = window.__SIGNUP_TEST_CALLS || [];
      window.__SIGNUP_TEST_CALLS.push({ method: 'updateUser', payload });

      if (scenario.updateUser === 'fail') {
        return {
          data: null,
          error: createError({ message: 'Update password failed' })
        };
      }

      emit('USER_UPDATED', session);
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

async function setupMockSupabase(page, scenario = {}) {
  await page.addInitScript((value) => {
    window.__SIGNUP_TEST_SCENARIO = value;
    window.__SIGNUP_TEST_CALLS = [];
  }, scenario);

  await page.route('**/@supabase/supabase-js@2*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: MOCK_SUPABASE_CDN_SCRIPT
    });
  });
}

test('signInWithOtp success opens OTP verification step and starts cooldown', async ({ page }) => {
  await setupMockSupabase(page, {
    signInWithOtp: 'success'
  });

  await page.goto('/#/auth?mode=signup');

  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();

  await expect(page.locator('#authSignupStepProgress')).toContainText('Шаг 2 из 3');
  await expect(page.locator('button[data-action="resend_otp"]')).toContainText('Повтор через');

  const calls = await page.evaluate(() => window.__SIGNUP_TEST_CALLS || []);
  expect(calls.some((call) => call.method === 'signInWithOtp')).toBeTruthy();
  expect(calls.some((call) => call.method === 'signInWithOtp' && call.payload.options && call.payload.options.shouldCreateUser)).toBeTruthy();
});

test('verifyOtp success opens password step', async ({ page }) => {
  await setupMockSupabase(page, {
    signInWithOtp: 'success',
    verifyOtp: 'success'
  });

  await page.goto('/#/auth?mode=signup');

  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authSignupStepProgress')).toContainText('Шаг 2 из 3');

  await page.locator('#authSignupOtp').fill('123456');
  await page.locator('button[data-action="verify_otp"]').click();

  await expect(page.locator('#authSignupStepProgress')).toContainText('Шаг 3 из 3');
  await expect(page.locator('#authSignupPassword')).toBeVisible();
});

test('verifyOtp invalid shows error and keeps verification step', async ({ page }) => {
  await setupMockSupabase(page, {
    signInWithOtp: 'success',
    verifyOtp: 'invalid'
  });

  await page.goto('/#/auth?mode=signup');

  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authSignupStepProgress')).toContainText('Шаг 2 из 3');

  await page.locator('#authSignupOtp').fill('123456');
  await page.locator('button[data-action="verify_otp"]').click();

  await expect(page.locator('#authStatus')).toContainText('Код недействителен или истек');
  await expect(page.locator('#authSignupStepProgress')).toContainText('Шаг 2 из 3');
});

test('updateUser success redirects to redirect hash after signup', async ({ page }) => {
  await setupMockSupabase(page, {
    signInWithOtp: 'success',
    verifyOtp: 'success',
    updateUser: 'success'
  });

  await page.goto('/#/auth?mode=signup&redirect=%23%2Fcatalog');

  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authSignupStepProgress')).toContainText('Шаг 2 из 3');

  await page.locator('#authSignupOtp').fill('123456');
  await page.locator('button[data-action="verify_otp"]').click();
  await expect(page.locator('#authSignupStepProgress')).toContainText('Шаг 3 из 3');

  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('#authSignupConfirmPassword').fill('123456');
  await page.locator('button[data-action="set_password"]').click();

  await expect(page).toHaveURL(/#\/catalog/);
  await expect(page.locator('#catalogSearchInput')).toBeVisible();
});

test('updateUser success redirects to account when redirect is missing', async ({ page }) => {
  await setupMockSupabase(page, {
    signInWithOtp: 'success',
    verifyOtp: 'success',
    updateUser: 'success'
  });

  await page.goto('/#/auth?mode=signup');

  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authSignupStepProgress')).toContainText('Шаг 2 из 3');

  await page.locator('#authSignupOtp').fill('123456');
  await page.locator('button[data-action="verify_otp"]').click();
  await expect(page.locator('#authSignupStepProgress')).toContainText('Шаг 3 из 3');

  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('#authSignupConfirmPassword').fill('123456');
  await page.locator('button[data-action="set_password"]').click();

  await expect(page).toHaveURL(/#\/account/);
  await expect(page.locator('#accountEmail')).toBeVisible();
});

test('429 on signup OTP request shows retry timing', async ({ page }) => {
  await setupMockSupabase(page, {
    signInWithOtp: 'rate_limit'
  });

  await page.goto('/#/auth?mode=signup');

  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authStatus')).toContainText('Повторить можно через 41 сек');
});

test('429 on signup OTP verify shows retry timing', async ({ page }) => {
  await setupMockSupabase(page, {
    signInWithOtp: 'success',
    verifyOtp: 'rate_limit'
  });

  await page.goto('/#/auth?mode=signup');
  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authSignupStepProgress')).toContainText('Шаг 2 из 3');

  await page.locator('#authSignupOtp').fill('123456');
  await page.locator('button[data-action="verify_otp"]').click();
  await expect(page.locator('#authStatus')).toContainText('Повторите через 37 сек');
});
