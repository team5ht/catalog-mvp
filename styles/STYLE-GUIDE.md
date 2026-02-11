# Стили проекта: актуальное состояние

Файл фиксирует реальную структуру CSS и основные контракты между стилями и JS.

## 1) Структура `styles/`

```text
styles/
  tokens.css
  ui.css
  pages.css
  STYLE-GUIDE.md
```

Папок `styles/components/` и `styles/pages/` в репозитории сейчас нет.

## 2) Порядок подключения CSS

Подключение вручную в `index.html`, порядок обязателен:

1. `styles/tokens.css`
2. `styles/ui.css`
3. `styles/pages.css`

## 3) Ответственность слоев

### `styles/tokens.css`

- Канонический источник дизайн-токенов (`:root`).
- Цвета, типографика, радиусы, отступы, тени.
- Safe-area и размеры нижней навигации.
- Motion-токены (`--motion-*`, `--motion-ease-standard`).

### `styles/ui.css`

- Глобальный reset и базовые правила (`box-sizing`, `body`, `main`, `hidden`).
- Общие UI-компоненты: кнопки (`.button*`), чипы (`.chip*`), карточки (`.material-card*`, `.catalog-card*`), карусели и общие контейнеры.
- Нижняя навигация (`.bottom-nav*`) и визуальные состояния аккаунта.
- Utility-классы (`.text-body`, `.load-error`, `.empty-state`, `.skeleton*`).
- Анимации входа (`.ui-enter`, `.ui-stagger`) и reduce-motion fallback.
- Экранный блокер ориентации (`.orientation-blocker`, `body.is-landscape-blocked`).

### `styles/pages.css`

- Page-specific layout для экранов: home (`.home-banner*`), catalog (`.catalog-shell`, `.catalog-search*`, `.catalog-list`), auth (`.auth-*`), material (`.material-page*`, `.material-download`), account (`.account-*`).
- Точечные responsive-правила для узких экранов.

## 4) DOM-контракты, на которые опирается JS

Классы и id ниже используются в JS напрямую; переименование без правок JS сломает поведение:

- `#spa-root`
- `#nav-home`, `#nav-catalog`, `#nav-account`
- `#main-materials`, `#materials-5ht`
- `#categories`, `#catalog-list`, `#catalogSearchInput`
- `#materialBackButton`, `#downloadBtn`, `#materialCover`, `#materialKicker`, `#materialTitle`, `#materialDescription`, `#materialTags`
- `#authLoginForm`, `#authEmail`, `#authPassword`, `#authError`
- `#accountEmail`, `#changePasswordButton`, `#logoutButton`, `#accountError`

## 5) Практические правила поддержки

- Новые токены добавлять в `tokens.css`, а не в page-файлы.
- Общие компоненты/утилиты добавлять в `ui.css`.
- Экранно-специфичные стили добавлять в `pages.css`.
- Сохранять BEM-подобный нейминг (`block__element--modifier`) и существующие префиксы.
