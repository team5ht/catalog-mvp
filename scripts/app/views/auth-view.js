import {
  AUTH_MODE_LOGIN,
  AUTH_MODE_RESET,
  AUTH_MODE_SIGNUP,
  AUTH_OTP_COOLDOWN_SECONDS,
  AUTH_OTP_MAX_LENGTH,
  AUTH_OTP_MIN_LENGTH,
  AUTH_VERIFY_MAX_ATTEMPTS,
  HOME_HASH,
  PASSWORD_MIN_LENGTH
} from '../constants.js';
import { getSpaRoot } from '../dom.js';
import {
  buildAuthHash,
  getAuthModeFromRoute,
  sanitizeRedirectHash
} from '../routing/hash.js';
import { navigateTo } from '../routing/navigation.js';
import {
  loginWithPassword,
  requestResetOtp,
  requestSignupOtp,
  signOutCurrentUser,
  updateUserPassword,
  verifyResetOtp,
  verifySignupOtp
} from '../services/auth-service.js';
import { isCurrentRender } from '../state.js';

const OTP_CODE_REGEX = new RegExp(`^\\d{${AUTH_OTP_MIN_LENGTH},${AUTH_OTP_MAX_LENGTH}}$`);
const FLOW_STAGE_REQUEST = 'request';
const FLOW_STAGE_VERIFY = 'verify';

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const email = value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function isAuthRateLimitError(error) {
  const status = Number(error && error.status);
  const code = String((error && error.code) || '').toLowerCase();
  const message = String((error && error.message) || '').toLowerCase();

  return (
    status === 429
    || code === 'over_email_send_rate_limit'
    || message.includes('only request this after')
    || message.includes('too many requests')
    || message.includes('rate limit')
  );
}

function isOtpInvalidOrExpiredError(error) {
  const code = String((error && error.code) || '').toLowerCase();
  const message = String((error && error.message) || '').toLowerCase();

  return (
    code === 'otp_expired'
    || code === 'token_expired'
    || code === 'invalid_grant'
    || code === 'validation_failed'
    || message.includes('otp expired')
    || message.includes('token expired')
    || message.includes('token has expired')
    || message.includes('invalid token')
    || message.includes('invalid otp')
    || message.includes('expired')
  );
}

function getRetryAfterSeconds(error, fallbackSeconds = AUTH_OTP_COOLDOWN_SECONDS) {
  const message = String((error && error.message) || '');
  const match = message.match(/after\s+(\d+)\s+seconds?/i);
  const parsed = match ? Number(match[1]) : NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  return fallbackSeconds;
}

function resolveCaptchaToken() {
  if (typeof window === 'undefined') {
    return '';
  }

  if (typeof window.getAuthCaptchaToken === 'function') {
    const token = window.getAuthCaptchaToken();
    return typeof token === 'string' ? token.trim() : '';
  }

  if (typeof window.AUTH_CAPTCHA_TOKEN === 'string') {
    return window.AUTH_CAPTCHA_TOKEN.trim();
  }

  return '';
}

function createAuthLayout({ title, subtitle, note, formMarkup }) {
  return `
    <div class="auth-page ui-enter">
      <section class="auth-panel" aria-labelledby="authTitle">
        <header class="auth-panel__header">
          <p class="screen-header__kicker">Доступ</p>
          <h1 id="authTitle" class="page-title auth-form__title">${title}</h1>
          <p class="screen-header__subtitle auth-form__subtitle text-body">${subtitle}</p>
        </header>

        <form class="auth-form" id="authForm" novalidate>
          ${formMarkup}
        </form>

        <p class="auth-form__note">${note}</p>
      </section>
    </div>
  `;
}

function setAuthRedirectLock(nextValue) {
  if (typeof window === 'undefined') {
    return;
  }

  window.__AUTH_MVP_V2_BLOCK_AUTH_REDIRECT = Boolean(nextValue);
}

export async function renderAuthView(route, renderToken) {
  const root = getSpaRoot();
  if (!root) {
    return;
  }

  setAuthRedirectLock(false);

  const requestedMode = getAuthModeFromRoute(route);
  const redirectHash = sanitizeRedirectHash(route?.query?.redirect);
  const loginRedirectHash = redirectHash || HOME_HASH;
  const postAuthRedirectHash = redirectHash || '#/account';
  const loginHash = buildAuthHash(redirectHash, { mode: AUTH_MODE_LOGIN });
  const signupHash = buildAuthHash(redirectHash, { mode: AUTH_MODE_SIGNUP });
  const resetHash = buildAuthHash(redirectHash, { mode: AUTH_MODE_RESET });

  if (requestedMode === AUTH_MODE_LOGIN) {
    root.innerHTML = createAuthLayout({
      title: 'Вход',
      subtitle: 'Введите email и пароль, чтобы войти в аккаунт.',
      note: 'Если забыли пароль, перейдите к восстановлению по одноразовому коду.',
      formMarkup: `
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
        </div>
        <div class="auth-form__meta">
          <a class="auth-form__link" href="${signupHash}">Нет аккаунта? Зарегистрироваться</a>
          <a class="auth-form__link" href="${resetHash}">Забыли пароль? Восстановить</a>
          <a id="authLoginResetCta" class="auth-form__link" href="${resetHash}" hidden>Перейти к восстановлению</a>
        </div>
      `
    });
  } else if (requestedMode === AUTH_MODE_SIGNUP) {
    root.innerHTML = createAuthLayout({
      title: 'Регистрация',
      subtitle: 'Введите email и пароль, затем подтвердите код из письма.',
      note: `Пароль не передается в Supabase до подтверждения OTP. Минимум ${PASSWORD_MIN_LENGTH} символов.`,
      formMarkup: `
        <div class="auth-stepper" id="authStepper" data-stage="${FLOW_STAGE_REQUEST}">
          <p id="authStepProgress" class="auth-stepper__progress">Шаг 1 из 2: Email и пароль</p>
          <div id="authStepBody" class="auth-stepper__body"></div>
          <p id="authStatus" class="auth-form__status" role="alert" aria-live="polite"></p>
          <div id="authStepActions" class="auth-form__actions"></div>
          <div class="auth-form__meta">
            <a class="auth-form__link" href="${loginHash}">Уже есть аккаунт? Войти</a>
            <a class="auth-form__link" href="${resetHash}">Забыли пароль? Восстановить</a>
          </div>
        </div>
      `
    });
  } else {
    root.innerHTML = createAuthLayout({
      title: 'Восстановление пароля',
      subtitle: 'Получите OTP-код по email, введите код и задайте новый пароль.',
      note: 'Ссылки восстановления не используются. Работает только код из письма.',
      formMarkup: `
        <div class="auth-stepper" id="authStepper" data-stage="${FLOW_STAGE_REQUEST}">
          <p id="authStepProgress" class="auth-stepper__progress">Шаг 1 из 2: Email</p>
          <div id="authStepBody" class="auth-stepper__body"></div>
          <p id="authStatus" class="auth-form__status" role="alert" aria-live="polite"></p>
          <div id="authStepActions" class="auth-form__actions"></div>
          <div class="auth-form__meta">
            <a class="auth-form__link" href="${loginHash}">Назад ко входу</a>
            <a class="auth-form__link" href="${signupHash}">Нет аккаунта? Зарегистрироваться</a>
          </div>
        </div>
      `
    });
  }

  const form = document.getElementById('authForm');
  const statusEl = document.getElementById('authStatus');
  const loginResetCta = document.getElementById('authLoginResetCta');

  if (!form || !statusEl) {
    return;
  }

  function setStatus(message, tone = 'error', options = {}) {
    const { showResetCta = false } = options;
    statusEl.classList.remove(
      'auth-form__status--visible',
      'auth-form__status--error',
      'auth-form__status--success',
      'auth-form__status--info'
    );

    if (loginResetCta) {
      loginResetCta.hidden = !showResetCta;
    }

    if (!message) {
      statusEl.textContent = '';
      return;
    }

    statusEl.textContent = message;
    statusEl.classList.add('auth-form__status--visible', `auth-form__status--${tone}`);
  }

  if (requestedMode === AUTH_MODE_LOGIN) {
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    if (!emailInput || !passwordInput) {
      return;
    }

    let isLoading = false;

    function setLoading(nextValue) {
      isLoading = Boolean(nextValue);
      form.setAttribute('aria-busy', isLoading ? 'true' : 'false');

      const controls = form.querySelectorAll('input, button');
      controls.forEach((control) => {
        control.disabled = isLoading;
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus('');

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

      if (isLoading) {
        return;
      }

      setLoading(true);

      try {
        const result = await loginWithPassword(email, password);
        if (!isCurrentRender(renderToken)) {
          return;
        }

        if (!result.ok) {
          setStatus(
            'Не удалось войти. Проверьте email и пароль или перейдите к восстановлению.',
            'error',
            { showResetCta: true }
          );
          return;
        }

        navigateTo(loginRedirectHash, { replace: true });
      } catch (error) {
        if (!isCurrentRender(renderToken)) {
          return;
        }
        console.warn('Ошибка входа', error);
        setStatus('Что-то пошло не так. Попробуйте ещё раз.', 'error', { showResetCta: true });
      } finally {
        if (isCurrentRender(renderToken)) {
          setLoading(false);
        }
      }
    });

    return;
  }

  const stepperEl = document.getElementById('authStepper');
  const stepProgressEl = document.getElementById('authStepProgress');
  const stepBodyEl = document.getElementById('authStepBody');
  const stepActionsEl = document.getElementById('authStepActions');

  if (!stepperEl || !stepProgressEl || !stepBodyEl || !stepActionsEl) {
    return;
  }

  const otpFlowMode = requestedMode === AUTH_MODE_SIGNUP ? AUTH_MODE_SIGNUP : AUTH_MODE_RESET;

  function initOtpFlow(variant) {
    let currentStage = FLOW_STAGE_REQUEST;
    let email = '';
    let password = '';
    let verifyAttempts = 0;
    let otpCooldownSeconds = 0;
    let otpCooldownInterval = null;
    let isLoading = false;

    function getCooldownButton() {
      return form.querySelector('button[data-cooldown-button="true"]');
    }

    function applyOtpCooldownUi() {
      const cooldownButton = getCooldownButton();
      if (!cooldownButton || isLoading) {
        return;
      }

      if (cooldownButton.dataset.defaultText == null) {
        cooldownButton.dataset.defaultText = cooldownButton.textContent || 'Отправить код';
      }

      if (otpCooldownSeconds > 0) {
        cooldownButton.disabled = true;
        cooldownButton.textContent = `Повтор через ${otpCooldownSeconds} c`;
      } else {
        cooldownButton.disabled = false;
        cooldownButton.textContent = cooldownButton.dataset.defaultText;
      }
    }

    function applyInteractiveState() {
      form.setAttribute('aria-busy', isLoading ? 'true' : 'false');

      const controls = form.querySelectorAll('input, button');
      controls.forEach((control) => {
        control.disabled = isLoading;
      });

      if (!isLoading) {
        const verifyButton = form.querySelector(`button[data-action="${variant.actions.verify}"]`);
        if (verifyButton && verifyAttempts >= AUTH_VERIFY_MAX_ATTEMPTS) {
          verifyButton.disabled = true;
        }
        applyOtpCooldownUi();
      }
    }

    function stopOtpCooldown() {
      if (otpCooldownInterval) {
        window.clearInterval(otpCooldownInterval);
        otpCooldownInterval = null;
      }

      otpCooldownSeconds = 0;
      applyInteractiveState();
    }

    function startOtpCooldown(seconds) {
      const normalizedSeconds = Math.max(1, Math.floor(Number(seconds) || AUTH_OTP_COOLDOWN_SECONDS));

      if (otpCooldownInterval) {
        window.clearInterval(otpCooldownInterval);
        otpCooldownInterval = null;
      }

      otpCooldownSeconds = normalizedSeconds;
      applyInteractiveState();

      otpCooldownInterval = window.setInterval(() => {
        if (!isCurrentRender(renderToken)) {
          window.clearInterval(otpCooldownInterval);
          otpCooldownInterval = null;
          return;
        }

        otpCooldownSeconds -= 1;
        if (otpCooldownSeconds <= 0) {
          stopOtpCooldown();
          return;
        }

        applyInteractiveState();
      }, 1000);
    }

    function focusCurrentInput() {
      const selector = currentStage === FLOW_STAGE_REQUEST
        ? variant.focusSelector.request
        : variant.focusSelector.verify;
      const input = form.querySelector(selector);
      if (input && typeof input.focus === 'function') {
        input.focus();
      }
    }

    function renderCurrentStage() {
      stepperEl.dataset.stage = currentStage;

      if (currentStage === FLOW_STAGE_REQUEST) {
        stepProgressEl.textContent = variant.progressText.request;
        stepBodyEl.innerHTML = variant.renderRequestBody({ email, password });
        stepActionsEl.innerHTML = variant.renderRequestActions();
      } else {
        const verifyDisabled = verifyAttempts >= AUTH_VERIFY_MAX_ATTEMPTS;
        stepProgressEl.textContent = variant.progressText.verify;
        stepBodyEl.innerHTML = variant.renderVerifyBody({ email, password });
        stepActionsEl.innerHTML = variant.renderVerifyActions({ verifyDisabled });
      }

      applyInteractiveState();
      focusCurrentInput();
    }

    function setLoading(nextValue) {
      isLoading = Boolean(nextValue);
      applyInteractiveState();
    }

    function resetStageTwoState() {
      variant.onResetStageTwoState({
        setPassword: (nextPassword) => {
          password = nextPassword;
        }
      });
      verifyAttempts = 0;
      stopOtpCooldown();
      currentStage = FLOW_STAGE_REQUEST;
      setStatus('');
      renderCurrentStage();
    }

    async function handleRequestOtp() {
      setStatus('');

      const requestData = variant.readRequestStageData({
        currentStage,
        email,
        password
      });
      const validationMessage = variant.validateRequestStageData(requestData);
      if (validationMessage) {
        setStatus(validationMessage);
        return;
      }

      if (otpCooldownSeconds > 0) {
        setStatus(`Повторная отправка будет доступна через ${otpCooldownSeconds} сек.`, 'info');
        return;
      }

      email = requestData.email;
      password = requestData.password;
      verifyAttempts = 0;

      setLoading(true);
      try {
        const result = await variant.requestOtp(email, {
          captchaToken: resolveCaptchaToken()
        });
        if (!isCurrentRender(renderToken)) {
          return;
        }

        if (!result.ok) {
          if (isAuthRateLimitError(result.error)) {
            const retryAfterSeconds = getRetryAfterSeconds(result.error, AUTH_OTP_COOLDOWN_SECONDS);
            startOtpCooldown(retryAfterSeconds);
            setStatus(`Слишком частая отправка. Повторите через ${retryAfterSeconds} сек.`, 'info');
            return;
          }

          setStatus(variant.messages.requestError);
          return;
        }

        currentStage = FLOW_STAGE_VERIFY;
        setStatus(variant.messages.requestSuccess, 'success');
        renderCurrentStage();
        startOtpCooldown(AUTH_OTP_COOLDOWN_SECONDS);
      } catch (error) {
        if (!isCurrentRender(renderToken)) {
          return;
        }
        console.warn(variant.logs.requestError, error);
        setStatus(variant.messages.requestError);
      } finally {
        if (isCurrentRender(renderToken)) {
          setLoading(false);
        }
      }
    }

    async function handleVerifyOtp() {
      setStatus('');

      if (verifyAttempts >= AUTH_VERIFY_MAX_ATTEMPTS) {
        setStatus('Лимит попыток исчерпан. Запросите новый код.', 'info');
        return;
      }

      const prerequisites = variant.getVerifyPrerequisites({ email, password });
      if (!prerequisites.ok) {
        currentStage = FLOW_STAGE_REQUEST;
        renderCurrentStage();
        setStatus(prerequisites.message, 'info');
        return;
      }

      const otpInput = document.getElementById(variant.ids.otpInput);
      const passwordInput = variant.ids.passwordInput ? document.getElementById(variant.ids.passwordInput) : null;
      const otpCode = String(otpInput ? otpInput.value : '')
        .trim()
        .replace(/\s+/g, '');
      const newPassword = variant.getVerifyPassword({
        password,
        passwordInput
      });

      if (!OTP_CODE_REGEX.test(otpCode)) {
        setStatus(`Введите ${AUTH_OTP_MIN_LENGTH}-${AUTH_OTP_MAX_LENGTH} цифр из письма.`);
        return;
      }

      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        setStatus(`Минимум ${PASSWORD_MIN_LENGTH} символов в новом пароле.`);
        return;
      }

      setAuthRedirectLock(true);
      setLoading(true);
      try {
        const verifyResult = await variant.verifyOtp({
          email,
          token: otpCode,
          captchaToken: resolveCaptchaToken()
        });
        if (!isCurrentRender(renderToken)) {
          return;
        }

        if (!verifyResult.ok) {
          if (isAuthRateLimitError(verifyResult.error)) {
            const retryAfterSeconds = getRetryAfterSeconds(verifyResult.error, AUTH_OTP_COOLDOWN_SECONDS);
            setStatus(`Слишком много попыток. Повторите через ${retryAfterSeconds} сек.`, 'info');
            return;
          }

          if (isOtpInvalidOrExpiredError(verifyResult.error)) {
            verifyAttempts += 1;
            variant.handleInvalidOtp({
              otpInput,
              passwordInput
            });

            if (verifyAttempts >= AUTH_VERIFY_MAX_ATTEMPTS) {
              setStatus('Лимит попыток исчерпан. Запросите новый код.', 'info');
              renderCurrentStage();
              return;
            }

            setStatus('Код недействителен или истек. Проверьте код и попробуйте снова.');
            renderCurrentStage();
            return;
          }

          setStatus('Не удалось подтвердить код. Попробуйте ещё раз.');
          return;
        }

        const updateResult = await updateUserPassword(newPassword);
        if (!isCurrentRender(renderToken)) {
          return;
        }

        if (!updateResult.ok) {
          await signOutCurrentUser();
          if (!isCurrentRender(renderToken)) {
            return;
          }

          resetStageTwoState();
          setStatus('Не удалось завершить установку пароля. Запросите новый код.');
          return;
        }

        variant.onVerifySuccess({
          setPassword: (nextPassword) => {
            password = nextPassword;
          }
        });
        stopOtpCooldown();
        navigateTo(postAuthRedirectHash, { replace: true });
      } catch (error) {
        if (!isCurrentRender(renderToken)) {
          return;
        }
        console.warn(variant.logs.verifyError, error);
        setStatus(variant.messages.verifyCompleteError);
      } finally {
        setAuthRedirectLock(false);
        if (isCurrentRender(renderToken)) {
          setLoading(false);
        }
      }
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (currentStage === FLOW_STAGE_REQUEST) {
        void handleRequestOtp();
        return;
      }

      void handleVerifyOtp();
    });

    form.addEventListener('click', (event) => {
      const actionButton = event.target.closest('button[data-action]');
      if (!actionButton || actionButton.type === 'submit') {
        return;
      }

      const action = actionButton.dataset.action || '';
      if (action === variant.actions.resend) {
        verifyAttempts = 0;
        void handleRequestOtp();
        return;
      }

      if (action === variant.actions.edit) {
        resetStageTwoState();
      }
    });

    renderCurrentStage();
  }

  const signupVariant = {
    actions: {
      verify: 'verify_signup_otp',
      resend: 'resend_signup_otp',
      edit: 'edit_signup_credentials'
    },
    ids: {
      otpInput: 'authSignupOtp',
      passwordInput: ''
    },
    focusSelector: {
      request: '#authSignupEmail',
      verify: '#authSignupOtp'
    },
    progressText: {
      request: 'Шаг 1 из 2: Email и пароль',
      verify: 'Шаг 2 из 2: Код из письма'
    },
    messages: {
      requestError: 'Не удалось отправить код регистрации. Попробуйте ещё раз.',
      requestSuccess: 'Код отправлен на email. Введите его для подтверждения регистрации.',
      verifyCompleteError: 'Не удалось завершить регистрацию. Попробуйте ещё раз.'
    },
    logs: {
      requestError: 'Ошибка отправки signup OTP',
      verifyError: 'Ошибка подтверждения signup OTP'
    },
    readRequestStageData(state) {
      let nextEmail = state.email;
      let nextPassword = state.password;

      if (state.currentStage === FLOW_STAGE_REQUEST) {
        const emailInput = document.getElementById('authSignupEmail');
        const passwordInput = document.getElementById('authSignupPassword');
        nextEmail = (emailInput ? emailInput.value : state.email || '').trim();
        nextPassword = passwordInput ? passwordInput.value || '' : state.password || '';
      }

      return {
        email: nextEmail,
        password: nextPassword
      };
    },
    validateRequestStageData(data) {
      if (!isValidEmail(data.email)) {
        return 'Введите корректный email.';
      }

      if (data.password.length < PASSWORD_MIN_LENGTH) {
        return `Минимум ${PASSWORD_MIN_LENGTH} символов в пароле.`;
      }

      return '';
    },
    getVerifyPrerequisites(state) {
      if (!isValidEmail(state.email) || state.password.length < PASSWORD_MIN_LENGTH) {
        return {
          ok: false,
          message: 'Сначала укажите email и пароль для регистрации.'
        };
      }

      return { ok: true };
    },
    getVerifyPassword({ password }) {
      return password;
    },
    requestOtp(nextEmail, options) {
      return requestSignupOtp(nextEmail, options);
    },
    verifyOtp(params) {
      return verifySignupOtp(params);
    },
    handleInvalidOtp({ otpInput }) {
      if (otpInput) {
        otpInput.value = '';
      }
    },
    onResetStageTwoState(store) {
      store.setPassword('');
    },
    onVerifySuccess(store) {
      store.setPassword('');
    },
    renderRequestBody(state) {
      return `
        <input
          type="email"
          id="authSignupEmail"
          class="auth-form__input"
          placeholder="name@example.com"
          value="${escapeHtml(state.email)}"
          autocomplete="email"
          inputmode="email"
          aria-label="Email"
          required
        />
        <input
          type="password"
          id="authSignupPassword"
          class="auth-form__input"
          placeholder="Пароль (мин. ${PASSWORD_MIN_LENGTH} символов)"
          value="${escapeHtml(state.password)}"
          autocomplete="new-password"
          aria-label="Пароль"
          required
        />
      `;
    },
    renderRequestActions() {
      return `
        <button
          type="submit"
          class="button button--primary"
          data-action="request_signup_otp"
          data-cooldown-button="true"
        >Зарегистрироваться</button>
      `;
    },
    renderVerifyBody(state) {
      return `
        <input
          type="email"
          id="authSignupEmailReadonly"
          class="auth-form__input"
          value="${escapeHtml(state.email)}"
          readonly
          aria-label="Email"
        />
        <input
          type="password"
          id="authSignupPasswordReadonly"
          class="auth-form__input"
          value="${escapeHtml(state.password)}"
          readonly
          aria-label="Пароль"
        />
        <input
          type="text"
          id="authSignupOtp"
          class="auth-form__input auth-form__input--otp"
          placeholder="Код из письма"
          minlength="${AUTH_OTP_MIN_LENGTH}"
          maxlength="${AUTH_OTP_MAX_LENGTH}"
          inputmode="numeric"
          autocomplete="one-time-code"
          aria-label="Одноразовый код"
          required
        />
      `;
    },
    renderVerifyActions({ verifyDisabled }) {
      const disabledAttribute = verifyDisabled ? 'disabled' : '';
      return `
        <button type="submit" class="button button--primary" data-action="verify_signup_otp" ${disabledAttribute}>Подтвердить</button>
        <button type="button" class="button button--secondary" data-action="resend_signup_otp" data-cooldown-button="true">Отправить код повторно</button>
        <button type="button" class="button button--secondary" data-action="edit_signup_credentials">Изменить email/пароль</button>
      `;
    }
  };

  const resetVariant = {
    actions: {
      verify: 'verify_reset_otp',
      resend: 'resend_reset_otp',
      edit: 'edit_reset_email'
    },
    ids: {
      otpInput: 'authResetOtp',
      passwordInput: 'authResetPassword'
    },
    focusSelector: {
      request: '#authResetEmail',
      verify: '#authResetOtp'
    },
    progressText: {
      request: 'Шаг 1 из 2: Email',
      verify: 'Шаг 2 из 2: Код и новый пароль'
    },
    messages: {
      requestError: 'Не удалось отправить код восстановления. Попробуйте ещё раз.',
      requestSuccess: 'Если аккаунт существует, мы отправили код восстановления на указанный email.',
      verifyCompleteError: 'Не удалось завершить восстановление. Попробуйте ещё раз.'
    },
    logs: {
      requestError: 'Ошибка отправки reset OTP',
      verifyError: 'Ошибка подтверждения reset OTP'
    },
    readRequestStageData(state) {
      let nextEmail = state.email;
      if (state.currentStage === FLOW_STAGE_REQUEST) {
        const emailInput = document.getElementById('authResetEmail');
        nextEmail = (emailInput ? emailInput.value : state.email || '').trim();
      }

      return {
        email: nextEmail,
        password: ''
      };
    },
    validateRequestStageData(data) {
      if (!isValidEmail(data.email)) {
        return 'Введите корректный email.';
      }

      return '';
    },
    getVerifyPrerequisites(state) {
      if (!isValidEmail(state.email)) {
        return {
          ok: false,
          message: 'Сначала укажите email для восстановления.'
        };
      }

      return { ok: true };
    },
    getVerifyPassword({ passwordInput }) {
      return String(passwordInput ? passwordInput.value : '');
    },
    requestOtp(nextEmail, options) {
      return requestResetOtp(nextEmail, options);
    },
    verifyOtp(params) {
      return verifyResetOtp(params);
    },
    handleInvalidOtp({ otpInput, passwordInput }) {
      if (otpInput) {
        otpInput.value = '';
      }
      if (passwordInput) {
        passwordInput.value = '';
      }
    },
    onResetStageTwoState() {
      // reset mode does not keep stage-1 password
    },
    onVerifySuccess() {
      // reset mode has no in-memory password cache
    },
    renderRequestBody(state) {
      return `
        <input
          type="email"
          id="authResetEmail"
          class="auth-form__input"
          placeholder="name@example.com"
          value="${escapeHtml(state.email)}"
          autocomplete="email"
          inputmode="email"
          aria-label="Email"
          required
        />
      `;
    },
    renderRequestActions() {
      return `
        <button
          type="submit"
          class="button button--primary"
          data-action="request_reset_otp"
          data-cooldown-button="true"
        >Отправить код</button>
      `;
    },
    renderVerifyBody(state) {
      return `
        <input
          type="email"
          id="authResetEmailReadonly"
          class="auth-form__input"
          value="${escapeHtml(state.email)}"
          readonly
          aria-label="Email"
        />
        <input
          type="text"
          id="authResetOtp"
          class="auth-form__input auth-form__input--otp"
          placeholder="Код из письма"
          minlength="${AUTH_OTP_MIN_LENGTH}"
          maxlength="${AUTH_OTP_MAX_LENGTH}"
          inputmode="numeric"
          autocomplete="one-time-code"
          aria-label="Одноразовый код"
          required
        />
        <input
          type="password"
          id="authResetPassword"
          class="auth-form__input"
          placeholder="Новый пароль (мин. ${PASSWORD_MIN_LENGTH} символов)"
          autocomplete="new-password"
          aria-label="Новый пароль"
          required
        />
      `;
    },
    renderVerifyActions({ verifyDisabled }) {
      const disabledAttribute = verifyDisabled ? 'disabled' : '';
      return `
        <button type="submit" class="button button--primary" data-action="verify_reset_otp" ${disabledAttribute}>Сохранить</button>
        <button type="button" class="button button--secondary" data-action="resend_reset_otp" data-cooldown-button="true">Отправить код повторно</button>
        <button type="button" class="button button--secondary" data-action="edit_reset_email">Изменить email/пароль</button>
      `;
    }
  };

  initOtpFlow(otpFlowMode === AUTH_MODE_SIGNUP ? signupVariant : resetVariant);
}
