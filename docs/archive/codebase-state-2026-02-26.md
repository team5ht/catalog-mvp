# Снимок состояния кодовой базы — 2026-02-26

Status: Archived
Owner: webapp team
Last reviewed: 2026-02-28
Scope: Исторический snapshot архитектуры и QA baseline.

## 1) Точка фиксации

- Repo: `catalog-mvp`
- Branch: `auth-flow-refactor`
- HEAD: `ba568a3` (`Part 1 of P2`)
- Формат проекта: static hash-SPA/PWA без bundler, browser ESM.

## 2) Актуальная архитектура

- Entry/wiring:
  - `scripts/app.js`
  - `scripts/app/bootstrap.js`
- Routing:
  - `scripts/app/routing/hash.js`
  - `scripts/app/routing/navigation.js`
  - `scripts/app/routing/router.js`
  - `scripts/app/routing/auth-guard.js`
- Views:
  - `scripts/app/views/home-view.js`
  - `scripts/app/views/catalog-view.js`
  - `scripts/app/views/material-view.js`
  - `scripts/app/views/auth-view.js`
  - `scripts/app/views/account-view.js`
- Services/store:
  - `scripts/app/services/data-service.js`
  - `scripts/app/services/auth-service.js`
  - `scripts/app/services/auth-redirect-coordinator.js`
  - `scripts/auth-store.js`
  - `scripts/supabase-client.js`
- UI/platform:
  - `scripts/app/ui/*`
  - `scripts/app/platform/*`
  - `sw.js`

## 3) Функциональный контракт (runtime)

- Роуты: `#/`, `#/catalog`, `#/material/:id`, `#/auth`, `#/account`.
- Auth режимы: `mode=login|signup|reset` (fallback на `login`).
- Auth flow:
  - login: `signInWithPassword`
  - signup: `signInWithOtp(shouldCreateUser=true)` -> `verifyOtp(type=email)` -> `updateUser(password)`
  - reset: `resetPasswordForEmail` -> `verifyOtp(type=recovery)` -> `updateUser(password)`
- Guard-правила:
  - guest на `#/account` -> redirect в `#/auth?redirect=#/account`
  - authed на `#/auth` -> redirect на валидный `redirect` или `#/account`
  - redirect принимает только внутренние валидные hash-route.
- Контракт безопасности:
  - Stage 2 для signup/reset не персистится;
  - OTP/пароли не пишутся в persistent browser storage.

## 4) Данные и ассеты

- `data.json`:
  - `categories`: 4
  - `materials`: 13 (`id` 1..13)
- Image pipeline:
  - cover: `160/240/320/480`, ratio `3:4`
  - hero: `640/960/1280`, ratio `8:3`
  - форматы: `webp` + `jpg`
- Service Worker cache namespace:
  - shell: `catalog-mvp-shell-v16`
  - images: `catalog-mvp-images-v17`

## 5) QA baseline

- `npm run images:check` -> `Проверка изображений пройдена. Проверено ассетов: 14.`
- `npm run test:e2e` -> `39 passed`.
- Состав e2e suite:
  - `tests/e2e/app-smoke.spec.js`: 18
  - `tests/e2e/auth-reset-otp.spec.js`: 9
  - `tests/e2e/auth-signup-otp.spec.js`: 7
  - `tests/e2e/navigation-auth-guards.spec.js`: 5

## 6) Наблюдаемый техдолг

- В `sw.js` в `shellPrecacheUrls` присутствует legacy запись `./scripts/nav-auth.js`, хотя файла в репозитории нет.
- Поведение сейчас деградирует мягко (warning + skip в `cache.add`), но запись стоит удалить при следующем code-change и повысить `SHELL_CACHE_NAME`.
