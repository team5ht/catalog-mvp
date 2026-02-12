import { HOME_HASH, PASSWORD_MIN_LENGTH } from '../constants.js';
import { getSpaRoot } from '../dom.js';
import { buildAuthHash } from '../routing/hash.js';
import { navigateTo } from '../routing/navigation.js';
import {
  getSupabaseClient,
  isAuthenticated,
  refreshAuthSession,
  updateUserPassword
} from '../services/auth-service.js';
import { isCurrentRender } from '../state.js';

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

export async function renderAccountView(renderToken) {
  const root = getSpaRoot();
  if (!root) {
    return;
  }

  const authState = await refreshAuthSession();

  if (!isCurrentRender(renderToken)) {
    return;
  }

  if (!isAuthenticated()) {
    navigateTo(buildAuthHash('#/account'), { replace: true });
    return;
  }

  root.innerHTML = `
      <header class="account-header screen-header ui-enter">
        <p class="account-kicker">Аккаунт</p>
        <h1 class="page-title">Личный кабинет</h1>
        <p class="account-subtitle text-body">Проверьте email и управляйте доступом к материалам.</p>
      </header>

      <section class="card account-card ui-enter" aria-labelledby="accountEmail">
        <div class="account-identity">
          <div>
            <p class="account-label">Ваш email</p>
            <p id="accountEmail" class="account-email">Загрузка...</p>
          </div>
        </div>

        <div class="account-actions">
          <button id="changePasswordButton" class="button button--secondary" type="button">Изменить пароль</button>
          <form id="accountPasswordForm" class="account-password-form" hidden novalidate>
            <input
              type="password"
              id="accountNewPassword"
              class="auth-form__input"
              placeholder="Новый пароль"
              required
              autocomplete="new-password"
              aria-label="Новый пароль"
            />
            <input
              type="password"
              id="accountConfirmPassword"
              class="auth-form__input"
              placeholder="Подтвердите новый пароль"
              required
              autocomplete="new-password"
              aria-label="Подтверждение нового пароля"
            />
            <div class="account-password-actions">
              <button id="accountSavePasswordButton" class="button button--primary" type="submit">Сохранить пароль</button>
              <button id="accountCancelPasswordButton" class="button button--secondary" type="button">Отмена</button>
            </div>
          </form>
          <button id="logoutButton" class="button button--primary" type="button">Выйти</button>
          <p id="accountStatus" class="account-status" role="alert" aria-live="polite"></p>
          <p class="account-version">Версия приложения v1</p>
        </div>
      </section>
    `;

  const emailEl = document.getElementById('accountEmail');
  const statusEl = document.getElementById('accountStatus');
  const logoutButton = document.getElementById('logoutButton');
  const changePasswordButton = document.getElementById('changePasswordButton');
  const passwordForm = document.getElementById('accountPasswordForm');
  const newPasswordInput = document.getElementById('accountNewPassword');
  const confirmPasswordInput = document.getElementById('accountConfirmPassword');
  const savePasswordButton = document.getElementById('accountSavePasswordButton');
  const cancelPasswordButton = document.getElementById('accountCancelPasswordButton');
  const client = getSupabaseClient();

  function setStatus(message, tone = 'error') {
    if (!statusEl) {
      return;
    }

    statusEl.classList.remove(
      'account-status--visible',
      'account-status--error',
      'account-status--success',
      'account-status--info'
    );

    if (message) {
      statusEl.textContent = message;
      statusEl.classList.add('account-status--visible', `account-status--${tone}`);
    } else {
      statusEl.textContent = '';
    }
  }

  function togglePasswordForm(nextOpenState) {
    if (!passwordForm || !changePasswordButton) {
      return;
    }

    const shouldOpen = typeof nextOpenState === 'boolean' ? nextOpenState : passwordForm.hidden;
    passwordForm.hidden = !shouldOpen;
    changePasswordButton.textContent = shouldOpen ? 'Скрыть форму' : 'Изменить пароль';

    if (!shouldOpen && typeof passwordForm.reset === 'function') {
      passwordForm.reset();
    }
  }

  if (emailEl) {
    emailEl.textContent = authState?.user?.email || 'Без email';
  }

  if (changePasswordButton) {
    changePasswordButton.addEventListener('click', () => {
      togglePasswordForm();
    });
  }

  if (cancelPasswordButton) {
    cancelPasswordButton.addEventListener('click', () => {
      togglePasswordForm(false);
      setStatus('');
    });
  }

  if (passwordForm && newPasswordInput && confirmPasswordInput && savePasswordButton && cancelPasswordButton) {
    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus('');

      const validationMessage = validatePasswordPair(newPasswordInput.value || '', confirmPasswordInput.value || '');
      if (validationMessage) {
        setStatus(validationMessage);
        return;
      }

      if (!client || !client.auth || typeof client.auth.updateUser !== 'function') {
        setStatus('Не удалось подключиться к сервису авторизации. Попробуйте позже.');
        return;
      }

      const controls = passwordForm.querySelectorAll('input, button');
      controls.forEach((control) => {
        control.disabled = true;
      });
      const saveDefaultText = savePasswordButton.textContent || 'Сохранить пароль';
      savePasswordButton.textContent = 'Сохраняем...';

      try {
        const result = await updateUserPassword(client, newPasswordInput.value || '');
        if (!result.ok) {
          setStatus('Не удалось обновить пароль. Попробуйте ещё раз.');
          return;
        }

        togglePasswordForm(false);
        setStatus('Пароль успешно обновлен.', 'success');
      } catch (error) {
        console.warn('Ошибка обновления пароля в профиле', error);
        setStatus('Не удалось обновить пароль. Попробуйте ещё раз.');
      } finally {
        controls.forEach((control) => {
          control.disabled = false;
        });
        savePasswordButton.textContent = saveDefaultText;
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      setStatus('');

      if (!client || typeof client.auth.signOut !== 'function') {
        navigateTo(buildAuthHash(HOME_HASH), { replace: true });
        return;
      }

      const defaultText = 'Выйти';
      logoutButton.disabled = true;
      logoutButton.textContent = 'Выходим...';

      try {
        const { error } = await client.auth.signOut();
        if (error) {
          throw error;
        }
        navigateTo(buildAuthHash(HOME_HASH), { replace: true });
      } catch (error) {
        console.warn('Ошибка при выходе из Supabase', error);
        logoutButton.disabled = false;
        logoutButton.textContent = defaultText;
        setStatus('Не удалось выйти. Попробуйте ещё раз.');
      }
    });
  }
}
