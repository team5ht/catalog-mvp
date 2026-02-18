const { test, expect } = require('@playwright/test');

const MOCK_SUPABASE_CDN_SCRIPT = `
(() => {
  const scenario = window.__AUTH_NAV_TEST_SCENARIO || {};
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
      return {
        data: null,
        error: {
          message: 'Mock sign-in disabled',
          status: 400,
          code: 'mock_error'
        }
      };
    },
    async signUp() {
      return { data: { user: null, session: null }, error: null };
    },
    async signOut() {
      emit('SIGNED_OUT', null);
      return { error: null };
    },
    async resetPasswordForEmail() {
      return { data: {}, error: null };
    },
    async verifyOtp() {
      return {
        data: {
          session,
          user: session ? session.user : null
        },
        error: null
      };
    },
    async updateUser() {
      return {
        data: {
          user: session ? session.user : null
        },
        error: null
      };
    }
  };

  window.supabase = {
    createClient() {
      return { auth };
    }
  };
})();
`;

async function setupMockSupabase(page, options = {}) {
  const { authenticated = false } = options;

  await page.addInitScript((scenario) => {
    window.__AUTH_NAV_TEST_SCENARIO = scenario;
  }, { authenticated });

  await page.route('**/@supabase/supabase-js@2*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: MOCK_SUPABASE_CDN_SCRIPT
    });
  });
}

test('guest account-tab click opens auth with redirect to current route', async ({ page }) => {
  await setupMockSupabase(page, { authenticated: false });

  await page.goto('/#/catalog');
  await expect(page.locator('#catalog-list .catalog-card').first()).toBeVisible();

  await page.locator('#nav-account').click();

  await expect(page).toHaveURL(/#\/auth\?redirect=%23%2Fcatalog/);
  await expect(page.locator('#authTitle')).toBeVisible();
});

test('authed account-tab click opens account route', async ({ page }) => {
  await setupMockSupabase(page, { authenticated: true });

  await page.goto('/#/');
  await expect(page.locator('#nav-account .bottom-nav__label')).toHaveText('Профиль');

  await page.locator('#nav-account').click();

  await expect(page).toHaveURL(/#\/account/);
  await expect(page.locator('#accountEmail')).toBeVisible();
});

test('authed opening auth login route redirects to redirect hash', async ({ page }) => {
  await setupMockSupabase(page, { authenticated: true });

  await page.goto('/#/');
  await expect(page.locator('#nav-account .bottom-nav__label')).toHaveText('Профиль');

  await page.goto('/#/auth?redirect=%23%2Fcatalog');

  await expect(page).toHaveURL(/#\/catalog/);
  await expect(page.locator('#catalogSearchInput')).toBeVisible();
});

test('authed opening forgot route does not redirect away from auth', async ({ page }) => {
  await setupMockSupabase(page, { authenticated: true });

  await page.goto('/#/auth?mode=forgot');

  await expect(page).toHaveURL(/#\/auth\?mode=forgot/);
  await expect(page.locator('#authTitle')).toHaveText('Восстановление пароля');
  await expect(page.locator('#authRecoveryEmail')).toBeVisible();
});
