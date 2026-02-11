# Каталог материалов 5HT (hash-SPA)

Статичное PWA-приложение на чистых HTML/CSS/JS с hash-routing и Supabase Auth.

## Актуальный статус

- SPA-shell: один входной файл `index.html` + маршруты `#/...`.
- Сборщика и серверного рендера нет.
- Каталог и карточки материалов берутся из `data.json`.
- Авторизация: Supabase email/password (вход, регистрация, выход).
- Auth-синхронизация централизована через `window.authStore`.
- Установка как PWA: `manifest.json` + `sw.js`.

## Технологический стек

- HTML/CSS/JS (vanilla)
- Supabase JS SDK через CDN (`@supabase/supabase-js@2`)
- Service Worker API + Web App Manifest

## Структура проекта

- `index.html` - HTML shell и подключение всех стилей/скриптов
- `scripts/app.js` - hash-router, рендер экранов, загрузка `data.json`, auth-gating
- `scripts/nav-auth.js` - состояние кнопки аккаунта в нижней навигации
- `scripts/supabase-client.js` - инициализация `window.supabaseClient`
- `scripts/auth-store.js` - единый источник auth-состояния (`window.authStore`)
- `supabase-config.js` - `window.SUPABASE_URL` и `window.SUPABASE_PUBLISHABLE_KEY`
- `data.json` - категории и материалы
- `sw.js` - кэширование и оффлайн-fallback
- `manifest.json` - PWA-манифест
- `styles/tokens.css`, `styles/ui.css`, `styles/pages.css` - стили
- `styles/STYLE-GUIDE.md` - актуальный гид по CSS-слоям
- `assets/icons/sprite.svg` - спрайт иконок нижней навигации

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
- Обе карусели сейчас заполняются одним и тем же списком `data.materials`.

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

- Кэш-версия: `catalog-mvp-v13`.
- Pre-cache: shell, скрипты, стили, `data.json`, иконки и ключевые изображения.
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

## Деплой

Проект рассчитан на GitHub Pages (корень/подпапка) за счет hash-routing.

- Канонический вход: `.../index.html#/...`
- Серверные rewrite-правила для deep links не требуются.

## Известные ограничения

- В `data.json` используются demo-ссылки `YOUR_FILE_ID_*` для PDF.
- Автотесты и линтеры в репозитории отсутствуют.
