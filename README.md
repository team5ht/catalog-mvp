# Каталог материалов 5HT (hash-SPA)

Статичное PWA-приложение на чистых HTML/CSS/JS с hash-routing и Supabase Auth.

## Актуальный статус

- SPA-shell: один входной файл `index.html` + маршруты `#/...`.
- Сборщика и серверного рендера нет.
- Каталог и карточки материалов берутся из `data.json`.
- Авторизация: Supabase email/password (вход, регистрация, выход, восстановление пароля).
- Auth-синхронизация централизована через `window.authStore`.
- Скриптовая часть `app` декомпозирована на ESM-модули (`scripts/app/*`).
- Установка как PWA: `manifest.json` + `sw.js`.

## Технологический стек

- HTML/CSS/JS (vanilla)
- ESM (browser-native modules, без bundler)
- Supabase JS SDK через CDN (`@supabase/supabase-js@2`)
- Service Worker API + Web App Manifest
- Playwright (`@playwright/test`) для smoke e2e

## Структура проекта

- `index.html` - HTML shell и подключение всех стилей/скриптов
- `scripts/app.js` - тонкий ESM entrypoint (`initApp`)
- `scripts/app/bootstrap.js` - инициализация приложения и подписки
- `scripts/app/constants.js` - общие константы маршрутов/auth
- `scripts/app/state.js` - runtime state (`currentRoute`, render token, ui state)
- `scripts/app/dom.js` - доступ к ключевым DOM-узлам shell
- `scripts/app/routing/*` - hash parsing, navigation, route processing
- `scripts/app/services/*` - доступ к auth-store/supabase и `data.json`
- `scripts/app/ui/*` - shell state и skeleton/error rendering
- `scripts/app/views/*` - рендеры экранов (`home`, `catalog`, `material`, `auth`, `account`)
- `scripts/app/platform/*` - orientation guard и регистрация SW
- `scripts/nav-auth.js` - состояние кнопки аккаунта в нижней навигации
- `scripts/supabase-client.js` - инициализация `window.supabaseClient`
- `scripts/auth-store.js` - единый источник auth-состояния (`window.authStore`)
- `supabase-config.js` - `window.SUPABASE_URL` и `window.SUPABASE_PUBLISHABLE_KEY`
- `data.json` - категории и материалы
- `sw.js` - кэширование и оффлайн-fallback
- `manifest.json` - PWA-манифест
- `styles/tokens.css`, `styles/ui.css`, `styles/pages.css` - стили
- `styles/STYLE-GUIDE.md` - актуальный гид по CSS-слоям
- `tests/e2e/app-smoke.spec.js` - smoke-тесты маршрутов и auth-gating
- `playwright.config.js` - конфигурация Playwright
- `docs/adr/2026-02-11-app-js-modularization.md` - подробный отчет по рефакторингу

## Архитектура скриптов (ESM)

- `scripts/app.js` только импортирует `initApp` из `scripts/app/bootstrap.js`.
- Роутинг и hash-утилиты вынесены в `scripts/app/routing/hash.js` и `scripts/app/routing/router.js`.
- Навигация с `replace`-обработчиком вынесена в `scripts/app/routing/navigation.js`.
- View-логика разделена по экранам, без изменения контрактов маршрутов и селекторов.
- State хранится централизованно в `scripts/app/state.js`.
- Поведение приложения сохранено (политика `no-behavior-change`).

## Контракт маршрутов

Канонические hash-маршруты:

- `#/` - главная
- `#/catalog` - каталог
- `#/material/:id` - детальная страница материала
- `#/auth` - вход/регистрация
- `#/account` - личный кабинет

Правила:

- Неизвестный маршрут -> редирект на `#/`.
- Невалидный `#/material/:id` -> редирект на `#/`.
- Auth redirect работает через `#/auth?redirect=<hash-route>`.
- `redirect` принимается только для внутренних и известных hash-route (`#/...`), иначе fallback в `#/`.

## Поведение экранов

### Главная (`#/`)

- Хедер, промо-баннер и 2 карусели материалов.
- Обе карусели заполняются списком `data.materials`.

### Каталог (`#/catalog`)

- Рабочий текстовый поиск (по `title`, `description`, `tags`).
- Фильтрация по категориям из `data.json`.
- Пустая выдача показывает сообщение "Ничего не найдено...".

### Материал (`#/material/:id`)

- Обложка, категория, описание, теги.
- Для авторизованного кнопка скачивания открывает `pdfUrl`.
- Для гостя кнопка скачивания ведет в auth с возвратом на текущий материал.
- Кнопка "Назад": `history.back()` при наличии in-app истории, иначе переход в `#/catalog`.

### Auth (`#/auth`)

- Единый экран с режимами через query-параметр `mode`:
  - `#/auth` - вход/регистрация
  - `#/auth?mode=forgot` - отправка письма для восстановления
  - `#/auth?mode=recovery` - установка нового пароля по recovery-ссылке
- Валидация email и пароля (минимум 6 символов), для смены/сброса - проверка подтверждения пароля.
- Ссылка "Забыли пароль?" ведет в `mode=forgot`.
- После успешного входа - переход на `redirect` или `#/`.
- Для recovery callback используется маркер `?auth_mode=recovery` в search URL: на старте приложения маркер очищается, и экран auth открывается в режиме recovery.

### Account (`#/account`)

- Доступ только при активной сессии.
- Показывает email пользователя.
- Поддерживает смену пароля (форма "Новый пароль" + "Подтверждение") через `supabase.auth.updateUser({ password })`.
- `Logout` через `supabase.auth.signOut()`.

## Данные (`data.json`)

`categories`:

- `id` (number)
- `name` (string)
- `slug` (string)

`materials`:

- `id` (number)
- `title` (string)
- `description` (string)
- `cover` (string URL)
- `pdfUrl` (string URL)
- `categoryId` (number)
- `tags` (string[])

## Supabase

Подключение в `index.html`:

```html
<script src="supabase-config.js"></script>
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
<script src="scripts/supabase-client.js"></script>
<script src="scripts/auth-store.js"></script>
<script type="module" src="scripts/app.js"></script>
<script src="scripts/nav-auth.js"></script>
```

Важно:

- `supabase-config.js` должен быть загружен до `scripts/supabase-client.js`.
- `scripts/auth-store.js` должен быть загружен после `scripts/supabase-client.js` и до `scripts/app.js` / `scripts/nav-auth.js`.
- В браузерном коде допустим только publishable key.
- Secret/service-role ключи нельзя хранить в репозитории и фронтенде.

Контракт `window.authStore`:

- `init()` - идемпотентная инициализация
- `subscribe(callback)` - подписка на auth-изменения
- `getSession()` - snapshot текущей сессии
- `isAuthenticated()` - признак авторизации
- `whenReady()` - промис первичной синхронизации
- `refresh()` - ручная пересинхронизация

## PWA / Service Worker

- Кэш-версия: `catalog-mvp-v14`.
- Pre-cache: shell, ESM-модули app, стили, `data.json`, иконки и ключевые изображения.
- Стратегия на `fetch`: network-first с fallback в кэш.
- Для `navigate` запросов fallback на `./index.html`.
- `manifest.json`: `start_url` и `scope` выставлены в `./`.

## Локальный запуск

Нужен HTTP-сервер (из файловой системы `fetch`/SW работают некорректно):

```bash
python -m http.server 8000
# или
npx serve .
```

Открыть: `http://localhost:8000/`.

## Тестирование (Playwright)

Установить зависимости:

```bash
npm install
npx playwright install chromium
```

Запустить smoke e2e:

```bash
npm run test:e2e
```

Покрытие smoke-тестов:

- `#/` (базовый рендер и загрузка карточек)
- `#/catalog` (поиск + фильтрация)
- `#/material/1` (guest CTA и redirect в auth)
- `#/account` (auth-gating)
- `#/auth?mode=forgot` (экран восстановления)
- `#/unknown` (редирект на home)
- sanity по active state нижней навигации

## Деплой

Проект рассчитан на GitHub Pages (корень/подпапка) за счет hash-routing.

- Канонический вход: `.../index.html#/...`
- Серверные rewrite-правила для deep links не требуются.

## Известные ограничения

- В `data.json` используются demo-ссылки `YOUR_FILE_ID_*` для PDF.
