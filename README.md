# Каталог материалов 5HT (hash-SPA)

Статичное PWA-приложение на чистых HTML/CSS/JS с hash-routing и Supabase Auth.

## Текущее состояние

- Один HTML shell (`index.html`) и маршрутизация через hash (`#/...`).
- Без bundler и серверного рендера: браузерные ESM-модули подключаются напрямую.
- Контент и каталог берутся из `data.json`.
- Обложки материалов и home hero генерируются локальным pipeline на `sharp`.
- Авторизация: Supabase email/password + OTP-восстановление пароля в приложении.
- Единый auth-state хранится в `window.authStore`.
- PWA: `manifest.json` + `sw.js` с precache shell и runtime cache изображений.

## Стек

- HTML/CSS/JS (vanilla)
- Browser ESM (без сборщика)
- Supabase JS SDK через CDN (`@supabase/supabase-js@2`)
- Service Worker API + Web App Manifest
- Playwright (`@playwright/test`) для e2e

## Скрипты npm

```bash
npm run images:build
npm run images:check
npm run test:e2e
npm run test:e2e:headed
```

## Структура

- `index.html` - shell, навигация, подключение CSS/JS.
- `scripts/app.js` - тонкий entrypoint (`initApp()`).
- `scripts/app/bootstrap.js` - инициализация, hashchange, auth-listener, SW/orientation.
- `scripts/app/routing/*` - parse/normalize hash, navigate/replace, route dispatch.
- `scripts/app/routing/auth-guard.js` - единые правила auth/account redirect.
- `scripts/app/views/*` - рендер экранов `home`, `catalog`, `material`, `auth`, `account`.
- `scripts/app/services/*` - `data.json`, Supabase/auth-store интеграция.
- `scripts/app/ui/*` - shell-state, account nav, placeholders/skeleton, responsive image helper.
- `scripts/app/state.js` - route/render token/catalog UI state/in-app history.
- `scripts/supabase-client.js` - инициализация `window.supabaseClient`.
- `scripts/auth-store.js` - глобальный store auth-сессии.
- `scripts/images/build.mjs` - генерация responsive-изображений.
- `scripts/images/check.mjs` - проверка data-контракта и image budgets/геометрии.
- `styles/tokens.css`, `styles/ui.css`, `styles/pages.css` - 3 CSS-слоя.
- `tests/e2e/app-smoke.spec.js`, `tests/e2e/auth-reset-otp.spec.js`, `tests/e2e/navigation-auth-guards.spec.js` - e2e сценарии.

## Маршруты

- `#/` - главная.
- `#/catalog` - каталог.
- `#/material/:id` - страница материала.
- `#/auth` - вход/регистрация.
- `#/account` - личный кабинет.

Правила:

- Неизвестные маршруты редиректятся на `#/`.
- Невалидный `#/material/:id` редиректится на `#/`.
- Redirect после auth передается через `#/auth?redirect=<hash>`.
- `redirect` принимается только для известных внутренних hash-route (`#/...`), иначе fallback `#/`.
- Прокрутка: при `push/replace` новый экран открывается сверху, при `Back/Forward` браузер восстанавливает предыдущую позицию.

## Поведение экранов

### Главная (`#/`)

- Рендерит hero-баннер и две карусели (`Новое`, `Популярное`).
- Обе карусели заполняются из `data.materials`.
- Заголовки карточек в каруселях ограничены 2 строками; лишний текст скрывается с многоточием.

### Каталог (`#/catalog`)

- Фильтрация по категории + текстовый поиск по `title`, `description`, `tags`.
- При пустой выдаче показывается `Ничего не найдено. Измените запрос или фильтр.`

### Материал (`#/material/:id`)

- Показывает обложку, категорию, описание, теги.
- Описание поддерживает простой markdown-like формат:
  - пустая строка -> новый абзац
  - строка с `- ` -> пункт списка
- Кнопка скачивания:
  - для гостя -> `#/auth?redirect=#/material/:id`
  - для авторизованного -> `window.open(pdfUrl)`
- Кнопка "Назад": `history.back()` при наличии in-app истории, иначе `#/catalog`.

### Auth (`#/auth`)

- `mode=login` (по умолчанию): вход/регистрация по email+паролю.
- `mode=forgot`: OTP recovery flow в 3 шага:
  - `request_code`
  - `verify_code`
  - `set_new_password`
- Валидации:
  - email regex
  - пароль минимум 6 символов
  - OTP только цифры, длина 6-8
- Legacy `mode=recovery` автоматически переводится в `mode=forgot` с инфо-сообщением.
- Состояние шага восстановления и cooldown хранится в `localStorage`.

### Account (`#/account`)

- Доступ только при активной сессии, иначе redirect в auth.
- Показывает email пользователя.
- Поддерживает смену пароля (`supabase.auth.updateUser({ password })`).
- Выход через `supabase.auth.signOut()`.

## Контракт `data.json`

`categories[]`:

- `id` (number)
- `name` (string)
- `slug` (string)

`materials[]`:

- `id` (number)
- `title` (string)
- `description` (string)
- `cover` (object)
  - `asset` (string, обязательно, формат `materials/<id>/cover`)
  - `alt` (string, обязательно)
  - `focalPoint` (string, optional, default `50% 50%`)
- `pdfUrl` (string)
- `categoryId` (number)
- `tags` (string[])

## Image pipeline

Команды:

```bash
npm run images:build
npm run images:check
```

Параметры генерации:

- Cover: `160/240/320/480w`, ratio `3:4`
- Hero: `640/960/1280w`, ratio `8:3`
- Форматы: `webp` (quality 72) и `jpg` (quality 78, progressive mozjpeg)

Что валидирует `images:check`:

- корректность `cover`-контракта в `data.json` (`asset`, `alt`, `focalPoint`)
- наличие source-файлов в `assets/images/src/...`
- наличие generated-файлов в `assets/images/generated/...`
- budgets веса для WebP/JPEG
- геометрию generated-файлов (ожидаемые width/height по ratio)

## Supabase и auth-store

Порядок подключения в `index.html`:

```html
<script src="supabase-config.js"></script>
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
<script src="scripts/supabase-client.js"></script>
<script src="scripts/auth-store.js"></script>
<script type="module" src="scripts/app.js"></script>
```

Важно:

- `supabase-config.js` должен быть загружен до `scripts/supabase-client.js`.
- В браузере используется только publishable key.
- Secret/service-role ключи нельзя хранить во фронтенде.

Контракт `window.authStore`:

- `init()`
- `subscribe(callback)`
- `getSession()`
- `isAuthenticated()`
- `whenReady()`
- `refresh()`

## PWA / Service Worker

- Cache names:
  - shell: `catalog-mvp-shell-v16`
  - images: `catalog-mvp-images-v17`
- Shell precache: `index.html`, ESM-модули, стили, `data.json`, манифест, иконки, hero-ассеты.
- Runtime для `/assets/images/generated/`: `stale-while-revalidate`.
- Для остальных same-origin GET: `network-first` с fallback в cache.
- Для `navigate` fallback на `./index.html`.
- В `manifest.json`: `start_url` и `scope` равны `./`.

## Локальный запуск

Нужен HTTP-сервер (без него `fetch` и SW работают некорректно):

```bash
python -m http.server 8000
# или
npx serve .
```

Открыть: `http://localhost:8000/`.

## Тестирование (Playwright)

Подготовка:

```bash
npm install
npm run images:build
npx playwright install chromium
```

Запуск:

```bash
npm run test:e2e
```

`playwright.config.js` поднимает локальный сервер командой `python -m http.server 4173`.

Что покрыто e2e:

- рендер `#/` и hero через `<img>` (`fetchpriority="high"`)
- каталог: поиск + фильтрация + empty state
- материал: корректный рендер описания (абзацы/список), CTA для гостя, redirect в auth
- `#/account` auth-gating
- `#/auth?mode=forgot` (OTP stepper)
- `#/auth?mode=recovery` (legacy redirect в forgot)
- `#/unknown` redirect на home
- active state кнопок нижней навигации
- sanity на отсутствие inline `background-image` в контентных обложках
- OTP сценарии (`tests/e2e/auth-reset-otp.spec.js`): success/error/rate-limit ветки
- auth/navigation guard сценарии (`tests/e2e/navigation-auth-guards.spec.js`): owner redirect и поведение кнопки аккаунта

## Деплой

Проект рассчитан на GitHub Pages (корень или подпапка) благодаря hash-routing.

- Канонический вход: `.../index.html#/...`
- Серверные rewrite для deep links не нужны.

## Известные ограничения

- В `data.json` используются demo-ссылки `YOUR_FILE_ID_*` для PDF.
