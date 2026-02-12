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
    async signUp() {
      return { error: null, data: { user: null, session: null } };
    },
    async signInWithPassword() {
      return { error: createError({ message: 'Mock sign-in disabled' }), data: null };
    },
    async signOut() {
      emit('SIGNED_OUT', null);
      return { error: null };
    },
    async resetPasswordForEmail(email, options) {
      window.__OTP_TEST_CALLS = window.__OTP_TEST_CALLS || [];
      window.__OTP_TEST_CALLS.push({ method: 'resetPasswordForEmail', email, options: options || {} });

      if (scenario.resetPasswordForEmail === 'rate_limit') {
        return {
          data: null,
          error: createError({
            status: 429,
            code: 'over_email_send_rate_limit',
            message: 'Only request this after 42 seconds'
          })
        };
      }

      if (scenario.resetPasswordForEmail === 'fail') {
        return {
          data: null,
          error: createError({ message: 'Reset email failed' })
        };
      }

      return { data: {}, error: null };
    },
    async verifyOtp(params) {
      window.__OTP_TEST_CALLS = window.__OTP_TEST_CALLS || [];
      window.__OTP_TEST_CALLS.push({ method: 'verifyOtp', params });

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

      emit('PASSWORD_RECOVERY', nextSession);

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

test('resetPasswordForEmail success opens OTP verification step and starts cooldown', async ({ page }) => {
  await setupMockSupabase(page, {
    resetPasswordForEmail: 'success'
  });

  await page.goto('/#/auth?mode=forgot');

  await page.locator('#authRecoveryEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 3');
  await expect(page.locator('button[data-action="resend_otp"]')).toContainText('Повтор через');
});

test('verifyOtp success opens new password step', async ({ page }) => {
  await setupMockSupabase(page, {
    resetPasswordForEmail: 'success',
    verifyOtp: 'success'
  });

  await page.goto('/#/auth?mode=forgot');

  await page.locator('#authRecoveryEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 3');

  await page.locator('#authRecoveryOtp').fill('12345678');
  await page.locator('button[data-action="verify_otp"]').click();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 3 из 3');
  await expect(page.locator('#authNewPassword')).toBeVisible();
});

test('verifyOtp invalid shows error and keeps verification step', async ({ page }) => {
  await setupMockSupabase(page, {
    resetPasswordForEmail: 'success',
    verifyOtp: 'invalid'
  });

  await page.goto('/#/auth?mode=forgot');

  await page.locator('#authRecoveryEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 3');

  await page.locator('#authRecoveryOtp').fill('123456');
  await page.locator('button[data-action="verify_otp"]').click();

  await expect(page.locator('#authStatus')).toContainText('Код недействителен или истек');
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 3');
});

test('updateUser success redirects to account after password change', async ({ page }) => {
  await setupMockSupabase(page, {
    resetPasswordForEmail: 'success',
    verifyOtp: 'success',
    updateUser: 'success'
  });

  await page.goto('/#/auth?mode=forgot');

  await page.locator('#authRecoveryEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 3');

  await page.locator('#authRecoveryOtp').fill('123456');
  await page.locator('button[data-action="verify_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 3 из 3');

  await page.locator('#authNewPassword').fill('123456');
  await page.locator('#authConfirmPassword').fill('123456');
  await page.locator('button[data-action="set_password"]').click();

  await expect(page).toHaveURL(/#\/account/);
});

test('429 on recover shows retry timing', async ({ page }) => {
  await setupMockSupabase(page, {
    resetPasswordForEmail: 'rate_limit'
  });

  await page.goto('/#/auth?mode=forgot');

  await page.locator('#authRecoveryEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authStatus')).toContainText('Повторить можно через 42 сек');
});

test('429 on verify shows retry timing', async ({ page }) => {
  await setupMockSupabase(page, {
    resetPasswordForEmail: 'success',
    verifyOtp: 'rate_limit'
  });

  await page.goto('/#/auth?mode=forgot');
  await page.locator('#authRecoveryEmail').fill('user@example.com');
  await page.locator('button[data-action="request_code"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 3');

  await page.locator('#authRecoveryOtp').fill('123456');
  await page.locator('button[data-action="verify_otp"]').click();
  await expect(page.locator('#authStatus')).toContainText('Повторите через 37 сек');
});
