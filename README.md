# Каталог материалов 5HT (MVP)

Статичный прототип каталога PDF-материалов с нижней навигацией, Supabase-авторизацией (email/пароль) и PWA-обёрткой.

## Страницы и флоу

- `index.html` — главная. Баннер с внешней ссылкой, две горизонтальные карусели материалов (`data.json`), нижняя навигация.
- `catalog.html` — лента карточек + чипы категорий. Поиск пока заглушка (disabled), фильтрация по категориям работает на клиенте.
- `material.html` — детальная страница по `?id=`: обложка, описание, теги, кнопка загрузки. Текст/статус кнопки завязаны на состояние авторизации; при отсутствии авторизации отправляет на `auth-login.html` с редиректом обратно. Кнопка «Назад» пытается вернуть на предыдущую страницу, избегая auth-страниц.
- Авторизация (новая): `auth-login.html` — форма входа/регистрации по email+паролю на Supabase. Поддерживает редирект через `?redirect=` или сохранённый в `AuthState`. Показывает блок «Вы уже вошли» и даёт выйти из сессии. `auth-check-email.html` и `auth-callback.html` перенаправляют пользователей старых «магических ссылок» на новую форму.
- Кнопка профиля в навигации (`nav-auth.js`): подстановка иконок вход/выход, редирект на форму входа с сохранением целевого URL, выход из Supabase и очистка `auth_logged_in`, отправка события `authstatechange`, небольшой toast.
- Легаси: `login.html` и `app.js#checkAuth` используют ключ `isLoggedIn` — оставлено для совместимости, основная логика авторизации опирается на `auth_logged_in` + сессию Supabase.

## Данные

`data.json` содержит:

- `categories[]`: `id`, `name`, `slug`.
- `materials[]`: `id`, `title`, `description`, `cover`, `pdfUrl`, `categoryId`, `tags[]`.
Карточки на всех страницах читают данные напрямую из этого файла; изображения и PDF — внешние URL.

## Авторизация и состояние

- `supabase-config.js` - объявляет `window.SUPABASE_URL` и `window.SUPABASE_PUBLISHABLE_KEY` (publishable/public key). Скрипт подключается до Supabase SDK и `supabase-client.js`; для другого проекта обновите значения здесь или проставьте их инлайном до загрузки клиента.
- `supabase-client.js` - создаёт shared-клиент Supabase из CDN, читает `window.SUPABASE_URL`/`window.SUPABASE_PUBLISHABLE_KEY`. При отсутствии SDK/конфигурации выводит warn и даёт `supabaseClient = null`.
- `auth-state.js` - модуль `window.AuthState`: синхронизирует сессию Supabase, кладёт флаг `auth_logged_in` в `localStorage`, хранит `authRedirectUrl`, отдаёт `isAuthenticated()`, `refreshSession()`, `getUser()` и шлёт `CustomEvent('authstatechange', { detail: { isAuthenticated, user } })`.
- `nav-auth.js` - управление кнопкой профиля: проверяет `AuthState`, подставляет иконку, сохраняет redirect, выполняет выход (включая `supabaseClient.auth.signOut()`), очищает `auth_logged_in` и транслирует `authstatechange`.
- `app.js` - вспомогательные проверки `isUserAuthenticated`, обработчик logout, рендер главных блоков, категорий и каталога. Использует `AuthState` при наличии.
- Inline-скрипты на страницах используют эти функции для рендера и навигации; кнопка скачивания на `material.html` переключает текст/стили в зависимости от авторизации.

## Стили

Система токенов и базовые слои: `styles/tokens.css`, `styles/base.css`, общие компоненты (`styles/components/*`), стили страниц (`styles/pages/*`). Подробности структуры и рекомендаций — в `styles/README.md`.

## PWA

- `manifest.json` с иконками (`icon-192.png`, `icon-512.png`) и скриншотом.
- `sw.js` кэширует список `urlsToCache` и работает под версией `catalog-mvp-v3`. Включены auth-страницы, основные скрипты и стили. При добавлении/переименовании файлов обновляйте список и версию кэша.

## Локальный запуск

Статический проект, сборки нет. Для корректной загрузки `data.json` и service worker нужен простой HTTP-сервер:

```bash
python -m http.server 8000
# или
npx serve .
```

Откройте `http://localhost:8000/`.

## Известные ограничения

- Поиск в каталоге пока заглушка.
- Конфигурация Supabase задаётся в `supabase-config.js` как `window.SUPABASE_URL/PUBLISHABLE_KEY`. Храните здесь только publishable key (secret не нужен и не должен попадать в браузер). Проверки email/пароля полностью на стороне Supabase, без собственного backend.
- В `data.json` стоят плейсхолдеры `pdfUrl`; для реальных материалов нужны валидные ссылки.
- Список кэша в `sw.js` поддерживается вручную; новый ассет/страницу нужно добавить в `urlsToCache` и поднять версию.
- Дублирование ключей авторизации (`auth_logged_in` vs `isLoggedIn`) сохранено для обратной совместимости - используйте `auth_logged_in`/`AuthState`.
