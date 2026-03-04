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

      const retryAfterSeconds = Math.max(1, Math.floor(Number(scenario.verifySignupRetryAfterSeconds) || 37));

      if (scenario.verifySignupOtp === 'rate_limit') {
        return {
          data: null,
          error: createError({
            status: 429,
            code: 'over_email_send_rate_limit',
            message: 'Only request this after ' + retryAfterSeconds + ' seconds'
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
  const longEmail = 'superlonglocalpartwithoutdots1234567890123456789012345678901234567890@example.com';

  await page.goto('/#/auth?mode=signup');
  await expect(page.locator('#authSubtitle')).toContainText('Введите email и пароль');
  await page.locator('#authSignupEmail').fill(longEmail);
  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('button[data-action="request_signup_otp"]').click();

  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');
  await expect(page.locator('#authSubtitle')).toContainText('Введите код из письма');
  await expect(page.locator('.auth-signup-verify__hint-prefix')).toHaveText('Мы отправили код на:');
  await expect(page.locator('.auth-signup-verify__hint-email')).toHaveAttribute('title', longEmail);
  await expect(page.locator('#authSignupEmailReadonly')).toHaveCount(0);
  await expect(page.locator('#authSignupPasswordReadonly')).toHaveCount(0);
  await expect(page.locator('#authSignupOtp')).toHaveAttribute('placeholder', '••••••••');
  await expect(page.locator('#authStatus')).not.toContainText('Код отправлен на email');
  await expect(page.locator('button[data-action="resend_signup_otp"]')).toContainText('Повтор через');

  const layout = await page.evaluate(() => {
    const prefix = document.querySelector('.auth-signup-verify__hint-prefix');
    const email = document.querySelector('.auth-signup-verify__hint-email');
    const verifyButton = document.querySelector('button[data-action="verify_signup_otp"]');
    const resendButton = document.querySelector('button[data-action="resend_signup_otp"]');
    const editButton = document.querySelector('button[data-action="edit_signup_credentials"]');

    const prefixTop = prefix ? prefix.getBoundingClientRect().top : NaN;
    const emailRects = email ? Array.from(email.getClientRects()) : [];
    const emailTop = emailRects.length > 0 ? emailRects[0].top : NaN;
    const verifyRect = verifyButton ? verifyButton.getBoundingClientRect() : null;
    const resendRect = resendButton ? resendButton.getBoundingClientRect() : null;
    const editRect = editButton ? editButton.getBoundingClientRect() : null;

    return {
      prefixTop,
      emailTop,
      emailRectsCount: emailRects.length,
      emailScrollWidth: email ? email.scrollWidth : NaN,
      emailClientWidth: email ? email.clientWidth : NaN,
      emailTextOverflow: email ? window.getComputedStyle(email).textOverflow : '',
      ctaToResendGap: verifyRect && resendRect ? resendRect.top - verifyRect.bottom : NaN,
      resendToEditGap: resendRect && editRect ? editRect.top - resendRect.bottom : NaN,
      resendHeight: resendRect ? resendRect.height : NaN,
      editHeight: editRect ? editRect.height : NaN
    };
  });
  expect(layout.emailTop).toBeGreaterThan(layout.prefixTop);
  expect(layout.emailRectsCount).toBe(1);
  expect(layout.emailScrollWidth).toBeGreaterThan(layout.emailClientWidth);
  expect(layout.emailTextOverflow).toBe('ellipsis');
  expect(layout.ctaToResendGap).toBeGreaterThan(15);
  expect(layout.ctaToResendGap).toBeLessThan(17.5);
  expect(layout.resendToEditGap).toBeGreaterThan(7);
  expect(layout.resendToEditGap).toBeLessThan(9.5);
  expect(layout.resendHeight).toBeGreaterThanOrEqual(40);
  expect(layout.editHeight).toBeGreaterThanOrEqual(40);

  const typography = await page.evaluate(() => {
    const rowText = document.querySelector('.auth-signup-links__row span');
    const rowLink = document.querySelector('.auth-signup-links__row .auth-form__link');
    const verifyLinkButton = document.querySelector('.auth-stepper[data-stage="verify"] .auth-signup-verify__link-button');
    const subtitle = document.getElementById('authSubtitle');
    const getFontSize = (element) => (element ? window.getComputedStyle(element).fontSize : '');

    return {
      rowText: getFontSize(rowText),
      rowLink: getFontSize(rowLink),
      verifyLinkButton: getFontSize(verifyLinkButton),
      subtitle: getFontSize(subtitle)
    };
  });
  expect(typography.rowText).toBe(typography.rowLink);
  expect(typography.verifyLinkButton).toBe(typography.rowLink);
  expect(typography.rowLink).toBe(typography.subtitle);
});

test.describe('signup verify actions mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('signup verify actions keep safe tap targets on mobile', async ({ page }) => {
    await setupMockSupabase(page, {
      requestSignupOtp: 'success'
    });

    await page.goto('/#/auth?mode=signup');
    await page.locator('#authSignupEmail').fill('user@example.com');
    await page.locator('#authSignupPassword').fill('123456');
    await page.locator('button[data-action="request_signup_otp"]').click();

    await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');
    await expect(page.locator('button[data-action="resend_signup_otp"]')).toContainText('Повтор через');

    const layout = await page.evaluate(() => {
      const verifyButton = document.querySelector('button[data-action="verify_signup_otp"]');
      const resendButton = document.querySelector('button[data-action="resend_signup_otp"]');
      const editButton = document.querySelector('button[data-action="edit_signup_credentials"]');

      const verifyRect = verifyButton ? verifyButton.getBoundingClientRect() : null;
      const resendRect = resendButton ? resendButton.getBoundingClientRect() : null;
      const editRect = editButton ? editButton.getBoundingClientRect() : null;

      return {
        ctaToResendGap: verifyRect && resendRect ? resendRect.top - verifyRect.bottom : NaN,
        resendToEditGap: resendRect && editRect ? editRect.top - resendRect.bottom : NaN,
        resendHeight: resendRect ? resendRect.height : NaN,
        editHeight: editRect ? editRect.height : NaN
      };
    });

    expect(layout.ctaToResendGap).toBeGreaterThan(15);
    expect(layout.ctaToResendGap).toBeLessThan(17.5);
    expect(layout.resendToEditGap).toBeGreaterThan(7);
    expect(layout.resendToEditGap).toBeLessThan(9.5);
    expect(layout.resendHeight).toBeGreaterThanOrEqual(40);
    expect(layout.editHeight).toBeGreaterThanOrEqual(40);
  });
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

test('429 on signup verify starts verify cooldown and restores verify action after backoff', async ({ page }) => {
  await setupMockSupabase(page, {
    requestSignupOtp: 'success',
    verifySignupOtp: 'rate_limit',
    verifySignupRetryAfterSeconds: 2
  });

  await page.goto('/#/auth?mode=signup');
  await page.locator('#authSignupEmail').fill('user@example.com');
  await page.locator('#authSignupPassword').fill('123456');
  await page.locator('button[data-action="request_signup_otp"]').click();
  await expect(page.locator('#authStepProgress')).toContainText('Шаг 2 из 2');

  const verifyButton = page.locator('button[data-action="verify_signup_otp"]');

  await page.locator('#authSignupOtp').fill('123456');
  await verifyButton.click();

  await expect(page.locator('#authStatus')).toContainText('2 сек');
  await expect(verifyButton).toContainText('Повтор через');
  await expect(verifyButton).toBeDisabled();

  await expect(verifyButton).toHaveText('Подтвердить', { timeout: 7000 });
  await expect(verifyButton).toBeEnabled();

  const activeElementId = await page.evaluate(() => (document.activeElement ? document.activeElement.id : ''));
  expect(activeElementId).toBe('authSignupOtp');
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
