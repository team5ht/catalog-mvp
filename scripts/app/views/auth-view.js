import {
  AUTH_MODE_FORGOT,
  AUTH_MODE_LOGIN,
  AUTH_MODE_RECOVERY,
  FORGOT_COOLDOWN_STORAGE_KEY,
  HOME_HASH,
  PASSWORD_MIN_LENGTH,
  RECOVERY_RESEND_COOLDOWN_SECONDS,
  RECOVERY_SEARCH_PARAM,
  RECOVERY_SEARCH_VALUE
} from '../constants.js';
import { getSpaRoot } from '../dom.js';
import {
  buildAuthHash,
  getAuthModeFromRoute,
  sanitizeRedirectHash
} from '../routing/hash.js';
import { navigateTo } from '../routing/navigation.js';
import {
  getSupabaseClient,
  isAuthenticated,
  refreshAuthSession,
  updateUserPassword
} from '../services/auth-service.js';
import { isCurrentRender } from '../state.js';

function isValidEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const email = value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function validatePasswordPair(password, confirmPassword) {
  const normalizedPassword = typeof password === 'string' ? password : '';
  const normalizedConfirmPassword = typeof confirmPassword === 'string' ? confirmPassword : '';

  if (normalizedPassword.length < PASSWORD_MIN_LENGTH) {
    return `Минимум ${PASSWORD_MIN_LENGTH} символов в пароле.`;
  }

  if (normalizedPassword !== normalizedConfirmPassword) {
    return 'Пароли не совпадают.';
  }

  return '';
}

function isAuthRateLimitError(error) {
  const status = Number(error && error.status);
  const code = String((error && error.code) || '').toLowerCase();
  const message = String((error && error.message) || '').toLowerCase();

  return (
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    message.includes('only request this after') ||
    message.includes('too many requests') ||
    message.includes('rate limit')
  );
}

function getRetryAfterSeconds(error, fallbackSeconds = RECOVERY_RESEND_COOLDOWN_SECONDS) {
  const message = String((error && error.message) || '');
  const match = message.match(/after\s+(\d+)\s+seconds?/i);
  const parsed = match ? Number(match[1]) : NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  return fallbackSeconds;
}

function buildRecoveryRedirectUrl() {
  const params = new URLSearchParams();
  params.set(RECOVERY_SEARCH_PARAM, RECOVERY_SEARCH_VALUE);

  const query = params.toString();
  const pathname = window.location.pathname || '/';
  return `${window.location.origin}${pathname}${query ? `?${query}` : ''}`;
}

export async function renderAuthView(route, renderToken) {
  const root = getSpaRoot();
  if (!root) {
    return;
  }

  const redirectHash = sanitizeRedirectHash(route.query.redirect) || HOME_HASH;
  const authMode = getAuthModeFromRoute(route);
  const loginHash = buildAuthHash(redirectHash);
  const forgotHash = buildAuthHash(redirectHash, { mode: AUTH_MODE_FORGOT });

  if (authMode === AUTH_MODE_LOGIN && isAuthenticated()) {
    navigateTo(redirectHash, { replace: true });
    return;
  }

  let authTitle = 'Вход или регистрация';
  let authSubtitle = 'Используйте email и пароль, чтобы войти или создать аккаунт.';
  let authNote = `
      Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов.
      Мы отправим письмо для подтверждения на ваш email.
    `;
  let formMarkup = `
      <input
        type="email"
        id="authEmail"
        class="auth-form__input"
        placeholder="name@example.com"
        required
        autocomplete="email"
        inputmode="email"
        aria-label="Email"
      />
      <input
        type="password"
        id="authPassword"
        class="auth-form__input"
        placeholder="Пароль (мин. ${PASSWORD_MIN_LENGTH} символов)"
        required
        autocomplete="current-password"
        aria-label="Пароль"
      />
      <p id="authStatus" class="auth-form__status" role="alert" aria-live="polite"></p>
      <div class="auth-form__actions">
        <button type="submit" class="button button--primary" data-action="login">Войти</button>
        <button type="submit" class="button button--secondary" data-action="signup">Зарегистрироваться</button>
      </div>
      <div class="auth-form__meta">
        <a class="auth-form__link" href="${forgotHash}">Забыли пароль?</a>
      </div>
    `;

  if (authMode === AUTH_MODE_FORGOT) {
    authTitle = 'Восстановление пароля';
    authSubtitle = 'Введите email, и мы отправим ссылку для сброса пароля.';
    authNote = 'Если аккаунт с таким email существует, письмо придет в течение пары минут.';
    formMarkup = `
        <input
          type="email"
          id="authRecoveryEmail"
          class="auth-form__input"
          placeholder="name@example.com"
          required
          autocomplete="email"
          inputmode="email"
          aria-label="Email для восстановления"
        />
        <p id="authStatus" class="auth-form__status" role="alert" aria-live="polite"></p>
        <div class="auth-form__actions">
          <button type="submit" class="button button--primary" data-action="forgot">Отправить ссылку</button>
        </div>
        <div class="auth-form__meta">
          <a class="auth-form__link" href="${loginHash}">Назад ко входу</a>
        </div>
      `;
  }

  if (authMode === AUTH_MODE_RECOVERY) {
    authTitle = 'Новый пароль';
    authSubtitle = 'Введите новый пароль для аккаунта.';
    authNote = `Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов.`;
    formMarkup = `
        <input
          type="password"
          id="authNewPassword"
          class="auth-form__input"
          placeholder="Новый пароль"
          required
          autocomplete="new-password"
          aria-label="Новый пароль"
        />
        <input
          type="password"
          id="authConfirmPassword"
          class="auth-form__input"
          placeholder="Подтвердите пароль"
          required
          autocomplete="new-password"
          aria-label="Подтверждение пароля"
        />
        <p id="authStatus" class="auth-form__status" role="alert" aria-live="polite"></p>
        <div class="auth-form__actions">
          <button type="submit" class="button button--primary" data-action="recovery">Сохранить пароль</button>
        </div>
        <div class="auth-form__meta">
          <a class="auth-form__link" href="${forgotHash}">Отправить новую ссылку</a>
          <a class="auth-form__link" href="${loginHash}">Назад ко входу</a>
        </div>
      `;
  }

  root.innerHTML = `
      <div class="auth-page ui-enter">
        <section class="auth-panel" aria-labelledby="authTitle">
          <header class="auth-panel__header">
            <p class="screen-header__kicker">Доступ</p>
            <h1 id="authTitle" class="page-title auth-form__title">${authTitle}</h1>
            <p class="screen-header__subtitle auth-form__subtitle text-body">${authSubtitle}</p>
          </header>

          <form class="auth-form" id="authForm" novalidate>
            ${formMarkup}
          </form>

          <p class="auth-form__note">${authNote}</p>
        </section>
      </div>
    `;

  void refreshAuthSession().then(() => {
    if (!isCurrentRender(renderToken) || authMode !== AUTH_MODE_LOGIN) {
      return;
    }
    if (isAuthenticated()) {
      navigateTo(redirectHash, { replace: true });
    }
  });

  const form = document.getElementById('authForm');
  const statusEl = document.getElementById('authStatus');
  const client = getSupabaseClient();
  let forgotCooldownSeconds = 0;
  let forgotCooldownInterval = null;

  if (!form || !statusEl) {
    return;
  }

  function setStatus(message, tone = 'error') {
    statusEl.classList.remove(
      'auth-form__status--visible',
      'auth-form__status--error',
      'auth-form__status--success',
      'auth-form__status--info'
    );

    if (message) {
      statusEl.textContent = message;
      statusEl.classList.add('auth-form__status--visible', `auth-form__status--${tone}`);
    } else {
      statusEl.textContent = '';
    }
  }

  function getForgotCooldownRemainingSecondsFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 0;
    }

    try {
      const rawValue = window.localStorage.getItem(FORGOT_COOLDOWN_STORAGE_KEY);
      if (!rawValue) {
        return 0;
      }

      const cooldownUntil = Number(rawValue);
      if (!Number.isFinite(cooldownUntil) || cooldownUntil <= 0) {
        window.localStorage.removeItem(FORGOT_COOLDOWN_STORAGE_KEY);
        return 0;
      }

      const remainingSeconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (remainingSeconds <= 0) {
        window.localStorage.removeItem(FORGOT_COOLDOWN_STORAGE_KEY);
        return 0;
      }

      return remainingSeconds;
    } catch (_error) {
      return 0;
    }
  }

  function persistForgotCooldownSeconds(seconds) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const normalizedSeconds = Math.max(1, Math.floor(Number(seconds) || 0));
    if (!normalizedSeconds) {
      return;
    }

    const cooldownUntil = Date.now() + normalizedSeconds * 1000;
    try {
      window.localStorage.setItem(FORGOT_COOLDOWN_STORAGE_KEY, String(cooldownUntil));
    } catch (_error) {
      // ignore write errors (e.g., private mode restrictions)
    }
  }

  function clearForgotCooldownStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.removeItem(FORGOT_COOLDOWN_STORAGE_KEY);
    } catch (_error) {
      // ignore remove errors
    }
  }

  function setLoading(isLoading) {
    const controls = form.querySelectorAll('input, button');
    form.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    const buttons = form.querySelectorAll('button[data-action]');
    buttons.forEach((button) => {
      if (button.dataset.defaultText == null) {
        button.dataset.defaultText = button.textContent;
      }
      button.textContent = isLoading ? 'Подождите...' : button.dataset.defaultText;
    });
    controls.forEach((control) => {
      control.disabled = isLoading;
    });

    if (!isLoading) {
      applyForgotCooldownUi();
    }
  }

  function getForgotButton() {
    return form.querySelector('button[data-action="forgot"]');
  }

  function applyForgotCooldownUi() {
    if (authMode !== AUTH_MODE_FORGOT) {
      return;
    }

    const forgotButton = getForgotButton();
    if (!forgotButton) {
      return;
    }

    if (forgotButton.dataset.defaultText == null) {
      forgotButton.dataset.defaultText = forgotButton.textContent || 'Отправить ссылку';
    }

    if (form.getAttribute('aria-busy') === 'true') {
      return;
    }

    if (forgotCooldownSeconds > 0) {
      forgotButton.disabled = true;
      forgotButton.textContent = `Повтор через ${forgotCooldownSeconds} c`;
    } else {
      forgotButton.disabled = false;
      forgotButton.textContent = forgotButton.dataset.defaultText;
    }
  }

  function stopForgotCooldown() {
    if (forgotCooldownInterval) {
      window.clearInterval(forgotCooldownInterval);
      forgotCooldownInterval = null;
    }

    forgotCooldownSeconds = 0;
    clearForgotCooldownStorage();
    applyForgotCooldownUi();
  }

  function startForgotCooldown(seconds) {
    const normalizedSeconds = Math.max(1, Math.floor(Number(seconds) || RECOVERY_RESEND_COOLDOWN_SECONDS));

    if (forgotCooldownInterval) {
      window.clearInterval(forgotCooldownInterval);
      forgotCooldownInterval = null;
    }

    forgotCooldownSeconds = normalizedSeconds;
    persistForgotCooldownSeconds(normalizedSeconds);
    applyForgotCooldownUi();

    forgotCooldownInterval = window.setInterval(() => {
      if (!isCurrentRender(renderToken)) {
        window.clearInterval(forgotCooldownInterval);
        forgotCooldownInterval = null;
        return;
      }

      forgotCooldownSeconds -= 1;
      if (forgotCooldownSeconds <= 0) {
        stopForgotCooldown();
        return;
      }

      applyForgotCooldownUi();
    }, 1000);
  }

  if (authMode === AUTH_MODE_LOGIN) {
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    if (!emailInput || !passwordInput) {
      return;
    }

    let submitAction = 'login';

    async function handleAuth(action) {
      setStatus('');

      if (!client || typeof client.auth.signInWithPassword !== 'function') {
        setStatus('Не удалось подключиться к сервису авторизации. Попробуйте позже.');
        return;
      }

      const email = (emailInput.value || '').trim();
      const password = passwordInput.value || '';

      if (!isValidEmail(email)) {
        setStatus('Введите корректный email.');
        return;
      }

      if (password.length < PASSWORD_MIN_LENGTH) {
        setStatus(`Минимум ${PASSWORD_MIN_LENGTH} символов в пароле.`);
        return;
      }

      setLoading(true);

      try {
        if (action === 'signup') {
          const { error } = await client.auth.signUp({ email, password });
          if (error) {
            const code = error.code || '';
            const message = (error.message || '').toLowerCase();
            if (
              code === 'user_already_exists' ||
              message.includes('user already registered') ||
              message.includes('user already exists')
            ) {
              setStatus('Этот email уже зарегистрирован. Попробуйте войти или восстановить пароль.');
            } else {
              setStatus('Не удалось зарегистрироваться. Попробуйте ещё раз или чуть позже.');
            }
            return;
          }

          setStatus(
            'Мы отправили письмо для подтверждения. После подтверждения вернитесь и войдите с паролем.',
            'success'
          );
          return;
        }

        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          setStatus('Не удалось войти. Проверьте email и пароль и попробуйте ещё раз.');
          return;
        }

        navigateTo(redirectHash, { replace: true });
      } catch (error) {
        console.warn('Ошибка авторизации', error);
        setStatus('Что-то пошло не так. Попробуйте ещё раз.');
      } finally {
        setLoading(false);
      }
    }

    form.addEventListener('click', (event) => {
      const actionButton = event.target.closest('button[data-action]');
      if (actionButton && actionButton.dataset.action) {
        submitAction = actionButton.dataset.action;
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void handleAuth(submitAction);
    });
    return;
  }

  if (authMode === AUTH_MODE_FORGOT) {
    const emailInput = document.getElementById('authRecoveryEmail');
    if (!emailInput) {
      return;
    }

    const persistedCooldown = getForgotCooldownRemainingSecondsFromStorage();
    if (persistedCooldown > 0) {
      startForgotCooldown(persistedCooldown);
    } else {
      applyForgotCooldownUi();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus('');

      if (!client || !client.auth || typeof client.auth.resetPasswordForEmail !== 'function') {
        setStatus('Не удалось подключиться к сервису авторизации. Попробуйте позже.');
        return;
      }

      const email = (emailInput.value || '').trim();

      if (!isValidEmail(email)) {
        setStatus('Введите корректный email.');
        return;
      }

      if (forgotCooldownSeconds > 0) {
        setStatus(`Повторная отправка будет доступна через ${forgotCooldownSeconds} сек.`, 'info');
        return;
      }

      setLoading(true);

      try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: buildRecoveryRedirectUrl()
        });

        if (error) {
          throw error;
        }

        setStatus(
          `Если аккаунт с этим email существует, мы отправили письмо с инструкцией по восстановлению пароля. Повторить отправку можно через ${RECOVERY_RESEND_COOLDOWN_SECONDS} сек.`,
          'success'
        );
        startForgotCooldown(RECOVERY_RESEND_COOLDOWN_SECONDS);
      } catch (error) {
        console.warn('Ошибка отправки recovery email', error);

        if (isAuthRateLimitError(error)) {
          const retryAfterSeconds = getRetryAfterSeconds(error, RECOVERY_RESEND_COOLDOWN_SECONDS);
          startForgotCooldown(retryAfterSeconds);
          setStatus(`Слишком частая отправка. Повторить можно через ${retryAfterSeconds} сек.`, 'info');
          return;
        }

        setStatus('Не удалось отправить письмо. Попробуйте ещё раз чуть позже.');
      } finally {
        setLoading(false);
      }
    });
    return;
  }

  const newPasswordInput = document.getElementById('authNewPassword');
  const confirmPasswordInput = document.getElementById('authConfirmPassword');
  if (!newPasswordInput || !confirmPasswordInput) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const validationMessage = validatePasswordPair(newPasswordInput.value || '', confirmPasswordInput.value || '');
    if (validationMessage) {
      setStatus(validationMessage);
      return;
    }

    setLoading(true);

    try {
      let syncedState = await refreshAuthSession({ force: true });
      if (!(syncedState && syncedState.user)) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 240);
        });
        syncedState = await refreshAuthSession({ force: true });
      }

      if (!(syncedState && syncedState.user)) {
        setStatus('Ссылка восстановления недействительна или устарела. Запросите новую ссылку.');
        return;
      }

      const result = await updateUserPassword(client, newPasswordInput.value || '');
      if (!result.ok) {
        setStatus('Не удалось обновить пароль. Запросите новую ссылку и попробуйте ещё раз.');
        return;
      }

      setStatus('Пароль обновлен. Перенаправляем в личный кабинет...', 'success');
      window.setTimeout(() => {
        navigateTo('#/account', { replace: true });
      }, 550);
    } catch (error) {
      console.warn('Ошибка обновления пароля по recovery-ссылке', error);
      setStatus('Не удалось обновить пароль. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  });
}
