const { test, expect } = require('@playwright/test');

const MOCK_SUPABASE_CDN_SCRIPT = `
(() => {
  const scenario = window.__OTP_TEST_SCENARIO || {};
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
      return { error: createError({ message: 'Mock sign-in disabled' }), data: null };
    },
    async signInWithOtp(params) {
      window.__OTP_TEST_CALLS = window.__OTP_TEST_CALLS || [];
      window.__OTP_TEST_CALLS.push({ method: 'signInWithOtp', params });

      if (!(params && params.options && params.options.shouldCreateUser)) {
        return {
          data: null,
          error: createError({ message: 'Unexpected non-signup OTP call', code: 'invalid_call' })
        };
      }

      if (scenario.requestSignupOtp === 'rate_limit') {
        return {
          data: null,
          error: createError({
            status: 429,
            code: 'over_email_send_rate_limit',
            message: 'Only request this after 41 seconds'
          })
        };
      }

      if (scenario.requestSignupOtp === 'fail') {
        return {
          data: null,
          error: createError({ message: 'Signup OTP failed' })
        };
      }

      return { data: {}, error: null };
    },
    async resetPasswordForEmail(email, options) {
      window.__OTP_TEST_CALLS = window.__OTP_TEST_CALLS || [];
      window.__OTP_TEST_CALLS.push({ method: 'resetPasswordForEmail', email, options: options || {} });

      if (scenario.requestResetOtp === 'rate_limit') {
        return {
          data: null,
          error: createError({
            status: 429,
            code: 'over_email_send_rate_limit',
            message: 'Only request this after 42 seconds'
          })
        };
      }

      if (scenario.requestResetOtp === 'fail') {
        return {
          data: null,
          error: createError({ message: 'Reset OTP failed' })
        };
      }

      return { data: {}, error: null };
    },
    async verifyOtp(params) {
      window.__OTP_TEST_CALLS = window.__OTP_TEST_CALLS || [];
      window.__OTP_TEST_CALLS.push({ method: 'verifyOtp', params });

      const verifyScenario = params && params.type === 'email' ? scenario.verifySignupOtp : scenario.verifyResetOtp;

      if (verifyScenario === 'rate_limit') {
        return {
          data: null,
          error: createError({
            status: 429,
            code: 'over_email_send_rate_limit',
            message: 'Only request this after 37 seconds'
          })
        };
      }

      if (verifyScenario === 'invalid') {
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
          email: params && params.email ? params.email : 'user@example.com'
        }
      };

      emit(params && params.type === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN', nextSession);

      return {
        data: {
          session: nextSession,
          user: nextSession.user
        },
        error: null
      };
    },
    async updateUser(payload) {
      window.__OTP_TEST_CALLS = window.__OTP_TEST_CALLS || [];
      window.__OTP_TEST_CALLS.push({ method: 'updateUser', payload });

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
      window.__OTP_TEST_CALLS = window.__OTP_TEST_CALLS || [];
      window.__OTP_TEST_CALLS.push({ method: 'signOut' });
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
    window.__OTP_TEST_SCENARIO = value;
    window.__OTP_TEST_CALLS = [];
  }, scenario);

  await page.route('**/@supabase/supabase-js@2*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: MOCK_SUPABASE_CDN_SCRIPT
    });
  });
}

test('reset OTP success opens verification step and starts cooldown', async ({ page }) => {
  await setupMockSupabase(page, {
    requestResetOtp: 'success'
  });

  await page.goto('/#/auth?mode=reset');

  await page.locator('#authResetEmail').fill('user@example.com');
  await page.locator('button[data-action="request_reset_otp"]').click();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');
  await expect(page.locator('button[data-action="resend_reset_otp"]')).toContainText('Повтор через');
});

test('reset OTP verify and password update redirects to account', async ({ page }) => {
  await setupMockSupabase(page, {
    requestResetOtp: 'success',
    verifyResetOtp: 'success',
    updateUser: 'success'
  });

  await page.goto('/#/auth?mode=reset');

  await page.locator('#authResetEmail').fill('user@example.com');
  await page.locator('button[data-action="request_reset_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');

  await page.locator('#authResetOtp').fill('123456');
  await page.locator('#authResetPassword').fill('123456');
  await page.locator('button[data-action="verify_reset_otp"]').click();

  await expect(page).toHaveURL(/#\/account/);
});

test('invalid reset OTP counts attempts and blocks verify after 5 failures', async ({ page }) => {
  await setupMockSupabase(page, {
    requestResetOtp: 'success',
    verifyResetOtp: 'invalid'
  });

  await page.goto('/#/auth?mode=reset');
  await page.locator('#authResetEmail').fill('user@example.com');
  await page.locator('button[data-action="request_reset_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await page.locator('#authResetOtp').fill('123456');
    await page.locator('#authResetPassword').fill('123456');
    await page.locator('button[data-action="verify_reset_otp"]').click();

    if (attempt < 5) {
      await expect(page.locator('#authStatus')).toContainText('Код недействителен или истек');
    }
  }

  await expect(page.locator('#authStatus')).toContainText('Лимит попыток исчерпан');
  await expect(page.locator('button[data-action="verify_reset_otp"]')).toBeDisabled();
});

test('reload on reset stage 2 returns to stage 1', async ({ page }) => {
  await setupMockSupabase(page, {
    requestResetOtp: 'success'
  });

  await page.goto('/#/auth?mode=reset');
  await page.locator('#authResetEmail').fill('user@example.com');
  await page.locator('button[data-action="request_reset_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');

  await page.reload();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 1 из 2');
  await expect(page.locator('#authResetEmail')).toBeVisible();
});

test('edit email/password from reset stage 2 clears cooldown UI and returns to stage 1', async ({ page }) => {
  await setupMockSupabase(page, {
    requestResetOtp: 'success'
  });

  await page.goto('/#/auth?mode=reset');
  await page.locator('#authResetEmail').fill('user@example.com');
  await page.locator('button[data-action="request_reset_otp"]').click();
  await expect(page.locator('button[data-action="resend_reset_otp"]')).toContainText('Повтор через');

  await page.locator('button[data-action="edit_reset_email"]').click();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 1 из 2');
  await expect(page.locator('button[data-action="request_reset_otp"]')).toHaveText('Отправить код');
});

test('429 on reset request shows retry timing', async ({ page }) => {
  await setupMockSupabase(page, {
    requestResetOtp: 'rate_limit'
  });

  await page.goto('/#/auth?mode=reset');
  await page.locator('#authResetEmail').fill('user@example.com');
  await page.locator('button[data-action="request_reset_otp"]').click();

  await expect(page.locator('#authStatus')).toContainText('42 сек');
});

test('429 on reset verify shows retry timing', async ({ page }) => {
  await setupMockSupabase(page, {
    requestResetOtp: 'success',
    verifyResetOtp: 'rate_limit'
  });

  await page.goto('/#/auth?mode=reset');
  await page.locator('#authResetEmail').fill('user@example.com');
  await page.locator('button[data-action="request_reset_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');

  await page.locator('#authResetOtp').fill('123456');
  await page.locator('#authResetPassword').fill('123456');
  await page.locator('button[data-action="verify_reset_otp"]').click();

  await expect(page.locator('#authStatus')).toContainText('37 сек');
});

test('updateUser failure after reset verify signs out and returns to stage 1', async ({ page }) => {
  await setupMockSupabase(page, {
    requestResetOtp: 'success',
    verifyResetOtp: 'success',
    updateUser: 'fail'
  });

  await page.goto('/#/auth?mode=reset');
  await page.locator('#authResetEmail').fill('user@example.com');
  await page.locator('button[data-action="request_reset_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');

  await page.locator('#authResetOtp').fill('123456');
  await page.locator('#authResetPassword').fill('123456');
  await page.locator('button[data-action="verify_reset_otp"]').click();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 1 из 2');
  await expect(page.locator('#authStatus')).toContainText('Не удалось завершить установку пароля');

  const signOutCallCount = await page.evaluate(() => {
    return (window.__OTP_TEST_CALLS || []).filter((call) => call.method === 'signOut').length;
  });
  expect(signOutCallCount).toBeGreaterThan(0);
});
