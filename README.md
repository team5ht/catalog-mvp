# Каталог материалов 5HT (hash-SPA)

Статичный PWA-каталог PDF-материалов на чистых HTML/CSS/JS без сборки и backend.

Приложение работает как **hash-SPA**: весь runtime идет через `index.html` и маршруты `#/...`.

## Технологии

- HTML/CSS/JS без сборщика
- Supabase Auth через CDN `@supabase/supabase-js@2`
- `data.json` как источник каталога
- Service Worker + `manifest.json` для PWA

## Структура проекта

- `index.html` — единственная точка входа SPA shell
- `scripts/app.js` — hash-router + рендер экранов (`home/catalog/material/auth/account`)
- `scripts/nav-auth.js` — состояние иконки профиля и переход в `#/auth`/`#/account`
- `supabase-config.js` — `window.SUPABASE_URL` и `window.SUPABASE_PUBLISHABLE_KEY`
- `scripts/supabase-client.js` — инициализация `window.supabaseClient`
- `data.json` — категории и материалы
- `sw.js` — кэширование shell/ассетов и fallback на `index.html`
- `manifest.json` — настройки standalone PWA
- `styles/tokens.css`, `styles/ui.css`, `styles/pages.css` — стили
- `assets/icons/sprite.svg` — спрайт иконок нижней навигации

## Route contract (hash-SPA)

Канонические маршруты:

- `#/` — главная
- `#/catalog` — каталог
- `#/material/:id` — детальная страница материала
- `#/auth` — вход/регистрация
- `#/account` — личный кабинет

Auth redirect:

- `#/auth?redirect=<encoded_hash_route>`
- Пример: `#/auth?redirect=%23%2Fmaterial%2F3`

Правила:

- неизвестный hash -> редирект на `#/`
- невалидный `material/:id` -> редирект на `#/`
- `redirect` принимает только внутренний hash-route (`#/...`), иначе fallback `#/`

## Важно: legacy URL больше не поддерживаются

Старые мультистраничные URL удалены и не являются рабочими маршрутами:

- `catalog.html`
- `material.html`
- `auth-login.html`
- `account.html`

Используйте только `index.html#/...`.

## Поведение экранов

### Главная (`#/`)

- Баннер + две карусели материалов
- Данные подгружаются из `data.json`

### Каталог (`#/catalog`)

- Поиск пока заглушка (disabled)
- Категории и карточки из `data.json`
- Фильтр по категории на клиенте

### Материал (`#/material/:id`)

- Обложка, описание, теги
- Кнопка "Скачать" доступна авторизованным
- Для гостя переход в auth с redirect на текущий материал
- Кнопка "Назад": `history.back()` при in-app history, иначе `#/catalog`

### Auth (`#/auth`)

- Одна форма: вход/регистрация
- Валидация email и пароля (мин. 6 символов)
- После успешного входа переход на route из `redirect`

### Account (`#/account`)

- Доступ только при активной сессии
- Отображает email
- Logout через Supabase `signOut()`

## Supabase

CDN подключается в `index.html`:

```html
<script src="supabase-config.js"></script>
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
<script src="scripts/supabase-client.js"></script>
```

`supabase-config.js` должен быть загружен до SDK и клиента.

## PWA / Service Worker

- Кэш: `catalog-mvp-v10`
- Pre-cache: SPA shell, скрипты, стили, ассеты, `data.json`
- `navigate` fallback: `index.html`
- `start_url`/`scope`: `./` (корректно для подпапок GitHub Pages)

## Локальный запуск

Нужен HTTP-сервер (иначе `fetch` и SW не будут работать корректно):

```bash
python -m http.server 8000
# или
npx serve .
```

Откройте `http://localhost:8000/`.

## Деплой на GitHub Pages

Приложение рассчитано на работу из подпапки/корня Pages за счет hash-routing.
Deep links открываются как `.../index.html#/...` без серверного rewrite.
