# Стили проекта: текущее состояние

Документ фиксирует фактическую CSS-структуру и селекторы, от которых напрямую зависит JS.

## 1) Структура `styles/`

```text
styles/
  tokens.css
  ui.css
  pages.css
  STYLE-GUIDE.md
```

Папок `styles/components/` и `styles/pages/` нет.

## 2) Порядок подключения

В `index.html` стили подключаются строго в таком порядке:

1. `styles/tokens.css`
2. `styles/ui.css`
3. `styles/pages.css`

## 3) Назначение CSS-слоев

### `tokens.css`

- Источник дизайн-токенов в `:root`.
- Цвета, типографика, spacing, радиусы, тени.
- Safe-area токены и размеры нижней навигации.
- Motion tokens (`--motion-*`, `--motion-ease-standard`).

### `ui.css`

- Глобальный reset и базовая типографика/контейнеры.
- Кнопки, чипы, карточки, карусели, skeleton, utility-классы.
- Нижняя навигация и ее состояния (`--active`, `is-loading`, `is-state-changing`).
- Анимации (`.ui-enter`, `.ui-stagger`) и `prefers-reduced-motion` fallback.
- Orientation guard: `.orientation-blocker`, `body.is-landscape-blocked`.

### `pages.css`

- Экранные layout-слои:
  - home (`.home-banner*`)
  - catalog (`.catalog-*`)
  - auth (`.auth-*`, `.auth-stepper*`)
  - material (`.material-page*`, `.material-download`)
  - account (`.account-*`)
- Responsive корректировки для узких ширин (`480px`, `380px`).

## 4) JS DOM-контракты

Ниже id/классы, которые JS читает или модифицирует напрямую. Переименование без синхронных правок JS сломает поведение.

### Общие

- `#spa-root`
- `#nav-home`
- `#nav-catalog`
- `#nav-account`
- `.bottom-nav`
- `.bottom-nav__button--active`
- `body.fullscreen-static`
- `body.is-landscape-blocked`
- `.orientation-blocker`

### Home

- `#homeHeroImage`
- `#main-materials`
- `#materials-5ht`

### Catalog

- `#catalogSearchInput`
- `#categories`
- `#catalog-list`
- `.catalog-categories__button`
- `.chip`
- `.chip--active`

### Material

- `#materialBackButton`
- `#downloadBtn`
- `#materialCover`
- `#materialKicker`
- `#materialTitle`
- `#materialDescription`
- `#materialTags`
- `.button--download.is-loading`

### Auth (login + signup OTP + forgot OTP)

- `#authForm`
- `#authStatus`
- `#authEmail`
- `#authPassword`
- `#authSignupStepper`
- `#authSignupStepProgress`
- `#authSignupStepBody`
- `#authSignupStepActions`
- `#authSignupEmail`
- `#authSignupEmailReadonly`
- `#authSignupOtp`
- `#authSignupPassword`
- `#authSignupConfirmPassword`
- `#authForgotStepper`
- `#authStepProgress`
- `#authStepBody`
- `#authStepActions`
- `#authRecoveryEmail`
- `#authRecoveryOtp`
- `#authRecoveryEmailReadonly`
- `#authNewPassword`
- `#authConfirmPassword`
- `button[data-action]`
- `button[data-cooldown-button="true"]`

### Account

- `#accountEmail`
- `#accountStatus`
- `#logoutButton`
- `#changePasswordButton`
- `#accountPasswordForm`
- `#accountNewPassword`
- `#accountConfirmPassword`
- `#accountSavePasswordButton`
- `#accountCancelPasswordButton`

## 5) Правила поддержки

- Новые токены добавлять только в `tokens.css`.
- Переиспользуемые UI-компоненты/утилиты добавлять в `ui.css`.
- Экранно-специфичные стили добавлять в `pages.css`.
- При изменении id/классов из раздела "JS DOM-контракты" обновлять JS в `scripts/app/*` и `scripts/nav-auth.js` в том же PR.
