const { test, expect } = require('@playwright/test');

const MOCK_SUPABASE_CDN_SCRIPT = `
(() => {
  const scenario = window.__SIGNUP_TEST_SCENARIO || {};
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
    async signInWithOtp(params) {
      window.__SIGNUP_TEST_CALLS = window.__SIGNUP_TEST_CALLS || [];
      window.__SIGNUP_TEST_CALLS.push({ method: 'signInWithOtp', params });

      if (!(params && params.options && params.options.shouldCreateUser)) {
        return {
          data: null,
          error: createError({ message: 'Unexpected OTP call', code: 'invalid_call' })
        };
      }

      if (scenario.requestSignupOtp === 'rate_limit') {
        return {
          data: null,
          error: createError({
            status: 429,
            code: 'over_email_send_rate_limit',
            message: 'Only request this after 42 seconds'
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
    async resetPasswordForEmail() {
      return { data: {}, error: null };
    },
    async verifyOtp(params) {
      window.__SIGNUP_TEST_CALLS = window.__SIGNUP_TEST_CALLS || [];
      window.__SIGNUP_TEST_CALLS.push({ method: 'verifyOtp', params });

      if (params && params.type !== 'email') {
        return {
          data: null,
          error: createError({ message: 'Unexpected verify type', code: 'invalid_type' })
        };
      }

      if (scenario.verifySignupOtp === 'rate_limit') {
        return {
          data: null,
          error: createError({
            status: 429,
            code: 'over_email_send_rate_limit',
            message: 'Only request this after 37 seconds'
          })
        };
      }

      if (scenario.verifySignupOtp === 'invalid') {
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

      emit('SIGNED_IN', nextSession);
      return { data: { session: nextSession, user: nextSession.user }, error: null };
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
      window.__SIGNUP_TEST_CALLS = window.__SIGNUP_TEST_CALLS || [];
      window.__SIGNUP_TEST_CALLS.push({ method: 'signOut' });
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

test('signup request OTP opens stage 2 and shows cooldown', async ({ page }) => {
  await setupMockSupabase(page, {
    requestSignupOtp: 'success'
  });

  await page.goto('/#/auth?mode=signup');
  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('button[data-action="request_signup_otp"]').click();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');
  await expect(page.locator('#authSignupEmailReadonly')).toHaveValue('user@example.com');
  await expect(page.locator('button[data-action="resend_signup_otp"]')).toContainText('Повтор через');
});

test('signup verify success updates password and redirects to account', async ({ page }) => {
  await setupMockSupabase(page, {
    requestSignupOtp: 'success',
    verifySignupOtp: 'success',
    updateUser: 'success'
  });

  await page.goto('/#/auth?mode=signup');
  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('button[data-action="request_signup_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');

  await page.locator('#authSignupOtp').fill('123456');
  await page.locator('button[data-action="verify_signup_otp"]').click();
  await expect(page).toHaveURL(/#\/account/);

  const updatePayload = await page.evaluate(() => {
    const call = (window.__SIGNUP_TEST_CALLS || []).find((entry) => entry.method === 'updateUser');
    return call ? call.payload : null;
  });
  expect(updatePayload).toEqual({ password: '123456' });
});

test('invalid signup OTP counts attempts and blocks verify after 5 failures', async ({ page }) => {
  await setupMockSupabase(page, {
    requestSignupOtp: 'success',
    verifySignupOtp: 'invalid'
  });

  await page.goto('/#/auth?mode=signup');
  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('button[data-action="request_signup_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await page.locator('#authSignupOtp').fill('123456');
    await page.locator('button[data-action="verify_signup_otp"]').click();

    if (attempt < 5) {
      await expect(page.locator('#authStatus')).toContainText('Код недействителен или истек');
    }
  }

  await expect(page.locator('#authStatus')).toContainText('Лимит попыток исчерпан');
  await expect(page.locator('button[data-action="verify_signup_otp"]')).toBeDisabled();
});

test('reload on signup stage 2 returns to stage 1', async ({ page }) => {
  await setupMockSupabase(page, {
    requestSignupOtp: 'success'
  });

  await page.goto('/#/auth?mode=signup');
  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('button[data-action="request_signup_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');

  await page.reload();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 1 из 2');
  await expect(page.locator('#authSignupEmail')).toBeVisible();
  await expect(page.locator('#authSignupPassword')).toBeVisible();
});

test('edit email/password from signup stage 2 clears cooldown UI and returns to stage 1', async ({ page }) => {
  await setupMockSupabase(page, {
    requestSignupOtp: 'success'
  });

  await page.goto('/#/auth?mode=signup');
  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('button[data-action="request_signup_otp"]').click();

  await expect(page.locator('button[data-action="resend_signup_otp"]')).toContainText('Повтор через');
  await page.locator('button[data-action="edit_signup_credentials"]').click();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 1 из 2');
  await expect(page.locator('button[data-action="request_signup_otp"]')).toHaveText('Зарегистрироваться');
  await expect(page.locator('#authSignupPassword')).toHaveValue('');
});

test('updateUser failure after signup verify signs out and returns to stage 1', async ({ page }) => {
  await setupMockSupabase(page, {
    requestSignupOtp: 'success',
    verifySignupOtp: 'success',
    updateUser: 'fail'
  });

  await page.goto('/#/auth?mode=signup');
  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('button[data-action="request_signup_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');

  await page.locator('#authSignupOtp').fill('123456');
  await page.locator('button[data-action="verify_signup_otp"]').click();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 1 из 2');
  await expect(page.locator('#authStatus')).toContainText('Не удалось завершить установку пароля');

  const signOutCallCount = await page.evaluate(() => {
    return (window.__SIGNUP_TEST_CALLS || []).filter((call) => call.method === 'signOut').length;
  });
  expect(signOutCallCount).toBeGreaterThan(0);
});
