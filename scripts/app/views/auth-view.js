import {
  AUTH_MODE_FORGOT,
  AUTH_MODE_LOGIN,
  HOME_HASH,
  LEGACY_FORGOT_COOLDOWN_STORAGE_KEY,
  LEGACY_RECOVERY_NOTICE_STORAGE_KEY,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_FLOW_STORAGE_KEY,
  PASSWORD_RESET_OTP_COOLDOWN_STORAGE_KEY,
  PASSWORD_RESET_OTP_MAX_LENGTH,
  PASSWORD_RESET_OTP_MIN_LENGTH,
  PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS
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
  refreshAuthSession,
  requestPasswordResetOtp,
  updateUserPassword,
  verifyPasswordResetOtp
} from '../services/auth-service.js';
import { isCurrentRender } from '../state.js';

const RESET_STEP_REQUEST = 'request_code';
const RESET_STEP_VERIFY = 'verify_code';
const RESET_STEP_PASSWORD = 'set_new_password';
const OTP_CODE_REGEX = new RegExp(`^\\d{${PASSWORD_RESET_OTP_MIN_LENGTH},${PASSWORD_RESET_OTP_MAX_LENGTH}}$`);

function isValidEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const email = value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function normalizeResetStep(inputStep) {
  if (typeof inputStep !== 'string') {
    return RESET_STEP_REQUEST;
  }

  const step = inputStep.trim().toLowerCase();
  if (step === RESET_STEP_REQUEST || step === RESET_STEP_VERIFY || step === RESET_STEP_PASSWORD) {
    return step;
  }

  return RESET_STEP_REQUEST;
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

function isOtpInvalidOrExpiredError(error) {
  const code = String((error && error.code) || '').toLowerCase();
  const message = String((error && error.message) || '').toLowerCase();

  return (
    code === 'otp_expired' ||
    code === 'token_expired' ||
    code === 'invalid_grant' ||
    code === 'validation_failed' ||
    message.includes('otp expired') ||
    message.includes('token expired') ||
    message.includes('token has expired') ||
    message.includes('invalid token') ||
    message.includes('invalid otp') ||
    message.includes('expired')
  );
}

function getRetryAfterSeconds(error, fallbackSeconds = PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS) {
  const message = String((error && error.message) || '');
  const match = message.match(/after\s+(\d+)\s+seconds?/i);
  const parsed = match ? Number(match[1]) : NaN;

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  return fallbackSeconds;
}

function migrateLegacyForgotCooldownIfNeeded() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const legacyValue = window.localStorage.getItem(LEGACY_FORGOT_COOLDOWN_STORAGE_KEY);
    const nextValue = window.localStorage.getItem(PASSWORD_RESET_OTP_COOLDOWN_STORAGE_KEY);

    if (!nextValue && legacyValue) {
      window.localStorage.setItem(PASSWORD_RESET_OTP_COOLDOWN_STORAGE_KEY, legacyValue);
    }

    window.localStorage.removeItem(LEGACY_FORGOT_COOLDOWN_STORAGE_KEY);
  } catch (_error) {
    // ignore storage access errors
  }
}

function readPasswordResetFlowState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      step: RESET_STEP_REQUEST,
      email: ''
    };
  }

  try {
    const rawValue = window.localStorage.getItem(PASSWORD_RESET_FLOW_STORAGE_KEY);
    if (!rawValue) {
      return {
        step: RESET_STEP_REQUEST,
        email: ''
      };
    }

    const parsed = JSON.parse(rawValue);
    const email = typeof parsed.email === 'string' ? parsed.email.trim() : '';

    return {
      step: normalizeResetStep(parsed.step),
      email
    };
  } catch (_error) {
    return {
      step: RESET_STEP_REQUEST,
      email: ''
    };
  }
}

function persistPasswordResetFlowState(step, email) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const safeEmail = typeof email === 'string' ? email.trim() : '';
  const safeStep = normalizeResetStep(step);

  try {
    window.localStorage.setItem(
      PASSWORD_RESET_FLOW_STORAGE_KEY,
      JSON.stringify({
        step: safeStep,
        email: safeEmail
      })
    );
  } catch (_error) {
    // ignore storage write errors
  }
}

function clearPasswordResetFlowState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(PASSWORD_RESET_FLOW_STORAGE_KEY);
  } catch (_error) {
    // ignore storage remove errors
  }
}

function getOtpCooldownRemainingSecondsFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 0;
  }

  try {
    const rawValue = window.localStorage.getItem(PASSWORD_RESET_OTP_COOLDOWN_STORAGE_KEY);
    if (!rawValue) {
      return 0;
    }

    const cooldownUntil = Number(rawValue);
    if (!Number.isFinite(cooldownUntil) || cooldownUntil <= 0) {
      window.localStorage.removeItem(PASSWORD_RESET_OTP_COOLDOWN_STORAGE_KEY);
      return 0;
    }

    const remainingSeconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (remainingSeconds <= 0) {
      window.localStorage.removeItem(PASSWORD_RESET_OTP_COOLDOWN_STORAGE_KEY);
      return 0;
    }

    return remainingSeconds;
  } catch (_error) {
    return 0;
  }
}

function persistOtpCooldownSeconds(seconds) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const normalizedSeconds = Math.max(1, Math.floor(Number(seconds) || 0));
  if (!normalizedSeconds) {
    return;
  }

  const cooldownUntil = Date.now() + normalizedSeconds * 1000;

  try {
    window.localStorage.setItem(PASSWORD_RESET_OTP_COOLDOWN_STORAGE_KEY, String(cooldownUntil));
  } catch (_error) {
    // ignore storage write errors
  }
}

function clearOtpCooldownStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(PASSWORD_RESET_OTP_COOLDOWN_STORAGE_KEY);
  } catch (_error) {
    // ignore storage remove errors
  }
}

function markLegacyRecoveryNotice() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(LEGACY_RECOVERY_NOTICE_STORAGE_KEY, '1');
  } catch (_error) {
    // ignore storage write errors
  }
}

function consumeLegacyRecoveryNotice() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const value = window.localStorage.getItem(LEGACY_RECOVERY_NOTICE_STORAGE_KEY);
    if (value !== '1') {
      return false;
    }

    window.localStorage.removeItem(LEGACY_RECOVERY_NOTICE_STORAGE_KEY);
    return true;
  } catch (_error) {
    return false;
  }
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

export async function renderAuthView(route, renderToken) {
  const root = getSpaRoot();
  if (!root) {
    return;
  }

  const redirectHash = sanitizeRedirectHash(route.query.redirect) || HOME_HASH;
  const requestedMode = typeof route?.query?.mode === 'string' ? route.query.mode.trim().toLowerCase() : '';
  const authMode = getAuthModeFromRoute(route);
  const loginHash = buildAuthHash(redirectHash);
  const forgotHash = buildAuthHash(redirectHash, { mode: AUTH_MODE_FORGOT });

  if (requestedMode === 'recovery') {
    markLegacyRecoveryNotice();
    navigateTo(forgotHash, { replace: true });
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
    authSubtitle = 'Введите email, получите одноразовый код и задайте новый пароль внутри приложения.';
    authNote = 'Код действует ограниченное время. Не передавайте его третьим лицам.';
    formMarkup = `
        <div class="auth-stepper" id="authForgotStepper" data-step="${RESET_STEP_REQUEST}">
          <p id="authStepProgress" class="auth-stepper__progress">Шаг 1 из 3</p>
          <div id="authStepBody" class="auth-stepper__body"></div>
          <p id="authStatus" class="auth-form__status" role="alert" aria-live="polite"></p>
          <div id="authStepActions" class="auth-form__actions"></div>
          <div class="auth-form__meta">
            <a class="auth-form__link" href="${loginHash}">Назад ко входу</a>
          </div>
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

  const form = document.getElementById('authForm');
  const statusEl = document.getElementById('authStatus');
  const client = getSupabaseClient();

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

  if (authMode === AUTH_MODE_LOGIN) {
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    if (!emailInput || !passwordInput) {
      return;
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

  migrateLegacyForgotCooldownIfNeeded();

  const stepProgressEl = document.getElementById('authStepProgress');
  const stepBodyEl = document.getElementById('authStepBody');
  const stepActionsEl = document.getElementById('authStepActions');
  const stepperEl = document.getElementById('authForgotStepper');

  if (!stepProgressEl || !stepBodyEl || !stepActionsEl || !stepperEl) {
    return;
  }

  let isLoading = false;
  let otpCooldownSeconds = getOtpCooldownRemainingSecondsFromStorage();
  let otpCooldownInterval = null;
  let successRedirectTimeoutId = null;

  const persistedFlow = readPasswordResetFlowState();
  let resetEmail = persistedFlow.email;
  let currentStep = persistedFlow.step;

  if (!isValidEmail(resetEmail)) {
    resetEmail = '';
    currentStep = RESET_STEP_REQUEST;
  }

  if (!resetEmail && currentStep !== RESET_STEP_REQUEST) {
    currentStep = RESET_STEP_REQUEST;
  }

  if (currentStep === RESET_STEP_PASSWORD) {
    const syncedState = await refreshAuthSession({ force: true });
    if (!(syncedState && syncedState.user)) {
      currentStep = resetEmail ? RESET_STEP_VERIFY : RESET_STEP_REQUEST;
    }
  }

  function setLoading(nextValue) {
    isLoading = Boolean(nextValue);
    form.setAttribute('aria-busy', isLoading ? 'true' : 'false');

    const controls = form.querySelectorAll('input, button');
    controls.forEach((control) => {
      control.disabled = isLoading;
    });

    if (!isLoading) {
      applyOtpCooldownUi();
    }
  }

  function getCooldownButton() {
    return form.querySelector('button[data-cooldown-button="true"]');
  }

  function applyOtpCooldownUi() {
    const cooldownButton = getCooldownButton();
    if (!cooldownButton) {
      return;
    }

    if (cooldownButton.dataset.defaultText == null) {
      cooldownButton.dataset.defaultText = cooldownButton.textContent || 'Отправить код';
    }

    if (isLoading) {
      return;
    }

    if (otpCooldownSeconds > 0) {
      cooldownButton.disabled = true;
      cooldownButton.textContent = `Повтор через ${otpCooldownSeconds} c`;
      return;
    }

    cooldownButton.disabled = false;
    cooldownButton.textContent = cooldownButton.dataset.defaultText;
  }

  function stopOtpCooldown() {
    if (otpCooldownInterval) {
      window.clearInterval(otpCooldownInterval);
      otpCooldownInterval = null;
    }

    otpCooldownSeconds = 0;
    clearOtpCooldownStorage();
    applyOtpCooldownUi();
  }

  function startOtpCooldown(seconds) {
    const normalizedSeconds = Math.max(1, Math.floor(Number(seconds) || PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS));

    if (otpCooldownInterval) {
      window.clearInterval(otpCooldownInterval);
      otpCooldownInterval = null;
    }

    otpCooldownSeconds = normalizedSeconds;
    persistOtpCooldownSeconds(normalizedSeconds);
    applyOtpCooldownUi();

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

      applyOtpCooldownUi();
    }, 1000);
  }

  function focusCurrentStepInput() {
    const selectors = {
      [RESET_STEP_REQUEST]: '#authRecoveryEmail',
      [RESET_STEP_VERIFY]: '#authRecoveryOtp',
      [RESET_STEP_PASSWORD]: '#authNewPassword'
    };

    const selector = selectors[currentStep];
    if (!selector) {
      return;
    }

    const input = form.querySelector(selector);
    if (input && typeof input.focus === 'function') {
      input.focus();
    }
  }

  function persistFlowState() {
    persistPasswordResetFlowState(currentStep, resetEmail);
  }

  function renderStep() {
    if (currentStep === RESET_STEP_REQUEST) {
      stepperEl.dataset.step = RESET_STEP_REQUEST;
      stepProgressEl.textContent = 'Шаг 1 из 3: Email';
      stepBodyEl.innerHTML = `
          <input
            type="email"
            id="authRecoveryEmail"
            class="auth-form__input"
            placeholder="name@example.com"
            value="${resetEmail}"
            required
            autocomplete="email"
            inputmode="email"
            aria-label="Email для восстановления"
          />
        `;
      stepActionsEl.innerHTML = `
          <button
            type="submit"
            class="button button--primary"
            data-action="request_code"
            data-cooldown-button="true"
          >Отправить код</button>
        `;
      applyOtpCooldownUi();
      return;
    }

    if (currentStep === RESET_STEP_VERIFY) {
      stepperEl.dataset.step = RESET_STEP_VERIFY;
      stepProgressEl.textContent = 'Шаг 2 из 3: Код из письма';
      stepBodyEl.innerHTML = `
          <input
            type="email"
            id="authRecoveryEmailReadonly"
            class="auth-form__input"
            value="${resetEmail}"
            readonly
            aria-label="Email для восстановления"
          />
          <input
            type="text"
            id="authRecoveryOtp"
            class="auth-form__input auth-form__input--otp"
            placeholder="Код из письма"
            maxlength="${PASSWORD_RESET_OTP_MAX_LENGTH}"
            minlength="${PASSWORD_RESET_OTP_MIN_LENGTH}"
            inputmode="numeric"
            pattern="[0-9]{${PASSWORD_RESET_OTP_MIN_LENGTH},${PASSWORD_RESET_OTP_MAX_LENGTH}}"
            autocomplete="one-time-code"
            aria-label="Одноразовый код"
            required
          />
        `;
      stepActionsEl.innerHTML = `
          <button type="submit" class="button button--primary" data-action="verify_otp">Проверить код</button>
          <button
            type="button"
            class="button button--secondary"
            data-action="resend_otp"
            data-cooldown-button="true"
          >Отправить код повторно</button>
          <button type="button" class="button button--secondary" data-action="edit_email">Изменить email</button>
        `;
      applyOtpCooldownUi();
      return;
    }

    stepperEl.dataset.step = RESET_STEP_PASSWORD;
    stepProgressEl.textContent = 'Шаг 3 из 3: Новый пароль';
    stepBodyEl.innerHTML = `
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
      `;
    stepActionsEl.innerHTML = `
        <button type="submit" class="button button--primary" data-action="set_password">Сохранить пароль</button>
        <button type="button" class="button button--secondary" data-action="restart_recovery">Запросить новый код</button>
      `;
  }

  function setStep(nextStep, options = {}) {
    const { keepStatus = false, focus = true } = options;
    currentStep = normalizeResetStep(nextStep);

    if (!resetEmail && currentStep !== RESET_STEP_REQUEST) {
      currentStep = RESET_STEP_REQUEST;
    }

    persistFlowState();
    renderStep();

    if (!keepStatus) {
      setStatus('');
    }

    if (focus) {
      focusCurrentStepInput();
    }
  }

  async function handleRequestOtp() {
    setStatus('');

    const emailInput = document.getElementById('authRecoveryEmail');
    const email = (emailInput ? emailInput.value : resetEmail || '').trim();

    if (!isValidEmail(email)) {
      setStatus('Введите корректный email.');
      return;
    }

    if (otpCooldownSeconds > 0) {
      setStatus(`Повторная отправка будет доступна через ${otpCooldownSeconds} сек.`, 'info');
      return;
    }

    resetEmail = email;
    persistFlowState();

    setLoading(true);

    try {
      const result = await requestPasswordResetOtp(email, {
        captchaToken: resolveCaptchaToken()
      });

      if (!result.ok) {
        const error = result.error;

        if (isAuthRateLimitError(error)) {
          const retryAfterSeconds = getRetryAfterSeconds(error, PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS);
          startOtpCooldown(retryAfterSeconds);
          setStatus(`Слишком частая отправка. Повторить можно через ${retryAfterSeconds} сек.`, 'info');
          return;
        }

        setStatus('Не удалось отправить код. Попробуйте ещё раз чуть позже.');
        return;
      }

      setStatus(
        `Если аккаунт с этим email существует, мы отправили одноразовый код. Повторная отправка будет доступна через ${PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS} сек.`,
        'success'
      );
      startOtpCooldown(PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS);
      setStep(RESET_STEP_VERIFY, {
        keepStatus: true
      });
    } catch (error) {
      console.warn('Ошибка отправки recovery OTP', error);
      setStatus('Не удалось отправить код. Попробуйте ещё раз чуть позже.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setStatus('');

    if (!isValidEmail(resetEmail)) {
      setStep(RESET_STEP_REQUEST);
      setStatus('Сначала укажите email для восстановления.', 'info');
      return;
    }

    const otpInput = document.getElementById('authRecoveryOtp');
    const otpCode = String(otpInput ? otpInput.value : '')
      .trim()
      .replace(/\s+/g, '');

    if (!OTP_CODE_REGEX.test(otpCode)) {
      setStatus(`Введите ${PASSWORD_RESET_OTP_MIN_LENGTH}-${PASSWORD_RESET_OTP_MAX_LENGTH}-значный код из письма.`);
      return;
    }

    setLoading(true);

    try {
      const result = await verifyPasswordResetOtp({
        email: resetEmail,
        token: otpCode,
        captchaToken: resolveCaptchaToken()
      });

      if (!result.ok) {
        const error = result.error;

        if (isAuthRateLimitError(error)) {
          const retryAfterSeconds = getRetryAfterSeconds(error, PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS);
          setStatus(`Слишком много попыток. Повторите через ${retryAfterSeconds} сек.`, 'info');
          return;
        }

        if (isOtpInvalidOrExpiredError(error)) {
          setStatus('Код недействителен или истек. Запросите новый код и попробуйте снова.');
          return;
        }

        setStatus('Не удалось подтвердить код. Попробуйте ещё раз.');
        return;
      }

      const syncedState = await refreshAuthSession({ force: true });
      if (!(syncedState && syncedState.user)) {
        setStatus('Не удалось подтвердить сессию восстановления. Запросите новый код.');
        return;
      }

      setStatus('Код подтвержден. Теперь задайте новый пароль.', 'success');
      setStep(RESET_STEP_PASSWORD, {
        keepStatus: true
      });
    } catch (error) {
      console.warn('Ошибка проверки recovery OTP', error);
      setStatus('Не удалось подтвердить код. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassword() {
    setStatus('');

    const newPasswordInput = document.getElementById('authNewPassword');
    const confirmPasswordInput = document.getElementById('authConfirmPassword');

    if (!newPasswordInput || !confirmPasswordInput) {
      setStatus('Форма смены пароля недоступна. Попробуйте ещё раз.');
      return;
    }

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
        setStep(RESET_STEP_VERIFY);
        setStatus('Сессия восстановления устарела. Подтвердите код повторно.', 'info');
        return;
      }

      const result = await updateUserPassword(client, newPasswordInput.value || '');
      if (!result.ok) {
        setStatus('Не удалось обновить пароль. Запросите новый код и попробуйте ещё раз.');
        return;
      }

      clearPasswordResetFlowState();
      stopOtpCooldown();
      setStatus('Пароль обновлен. Перенаправляем в личный кабинет...', 'success');
      if (successRedirectTimeoutId) {
        window.clearTimeout(successRedirectTimeoutId);
      }

      successRedirectTimeoutId = window.setTimeout(() => {
        successRedirectTimeoutId = null;
        if (!isCurrentRender(renderToken)) {
          return;
        }
        navigateTo('#/account', { replace: true });
      }, 550);
    } catch (error) {
      console.warn('Ошибка установки нового пароля', error);
      setStatus('Не удалось обновить пароль. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (currentStep === RESET_STEP_REQUEST) {
      void handleRequestOtp();
      return;
    }

    if (currentStep === RESET_STEP_VERIFY) {
      void handleVerifyOtp();
      return;
    }

    void handleSetNewPassword();
  });

  form.addEventListener('click', (event) => {
    const actionButton = event.target.closest('button[data-action]');
    if (!actionButton || actionButton.type === 'submit') {
      return;
    }

    const action = actionButton.dataset.action || '';

    if (action === 'resend_otp') {
      void handleRequestOtp();
      return;
    }

    if (action === 'edit_email') {
      setStep(RESET_STEP_REQUEST);
      return;
    }

    if (action === 'restart_recovery') {
      clearPasswordResetFlowState();
      setStep(RESET_STEP_REQUEST);
      setStatus('Введите email, чтобы запросить новый код.', 'info');
    }
  });

  renderStep();
  persistFlowState();

  if (otpCooldownSeconds > 0) {
    startOtpCooldown(otpCooldownSeconds);
  }

  if (consumeLegacyRecoveryNotice()) {
    setStatus('Ссылки восстановления отключены. Используйте одноразовый код из письма.', 'info');
  }

  focusCurrentStepInput();
}
