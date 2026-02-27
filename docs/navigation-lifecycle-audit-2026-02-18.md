# Аудит архитектуры навигации и lifecycle экранов

Исходный аудит был выполнен 2026-02-18. Ниже зафиксирован актуальный status update по состоянию на 2026-02-26.

Дата status update: 2026-02-26  
Область: `scripts/app/routing/*`, `scripts/app/bootstrap.js`, `scripts/app/state.js`, `scripts/app/views/*`, `scripts/app/ui/account-nav.js`, `sw.js`  
Целевой контекст: hash-SPA/PWA каталог с auth-flow `login/signup/reset`.

## 1) Что проверено

- Роутинг и orchestration:
  - `scripts/app/routing/hash.js`
  - `scripts/app/routing/navigation.js`
  - `scripts/app/routing/router.js`
  - `scripts/app/routing/auth-guard.js`
- Инициализация и lifecycle:
  - `scripts/app/bootstrap.js`
  - `scripts/app/state.js`
  - `scripts/app/views/home-view.js`
  - `scripts/app/views/catalog-view.js`
  - `scripts/app/views/material-view.js`
  - `scripts/app/views/auth-view.js`
  - `scripts/app/views/account-view.js`
- Навигация аккаунта:
  - `scripts/app/ui/account-nav.js` (legacy `scripts/nav-auth.js` отсутствует).
- Валидация:
  - `npm run images:check` -> `Проверка изображений пройдена. Проверено ассетов: 14.`
  - `npm run test:e2e` -> `39 passed`.

## 2) Текущее состояние архитектуры (as-is)

### 2.1 Инициализация приложения

1. Entry-point `scripts/app.js` вызывает `initApp()`.
2. В `scripts/app/bootstrap.js` выполняются bind-и shell/nav/auth/orientation/SW.
3. При пустом hash выполняется канонизация через `history.replaceState(...#/...)`, затем единичный `processCurrentHash({ historyMode: 'initial' })`.
4. На `hashchange` используется `consumePendingHistoryMode` для корректной pop/push/replace семантики.

### 2.2 Навигация и рендер

1. `processCurrentHash()` парсит route (`hash.js`) и применяет auth guard (`auth-guard.js`).
2. `applyRoute()`:
   - сохраняет route в state,
   - обновляет in-app history (`recordRouteVisit`),
   - применяет scroll policy,
   - переключает shell-state,
   - диспатчит рендер нужного view.
3. Для async-веток используется `renderToken` (`isCurrentRender`) против устаревших DOM-записей.

### 2.3 Lifecycle экранов

- `home`/`catalog`: кешируемые view-node + shared data loading promise.
- `material`/`auth`/`account`: fresh render на навигацию.
- Async-hydration `home/catalog` безопасна при churn маршрутов: каждый рендер подписывается на тот же shared promise, но применяет результат только если token актуален.

## 3) Статус findings из аудита 2026-02-18

### P0: потеря гидрации `home/catalog` при смене renderToken во время shared-loading

- Статус: `Resolved`.
- Актуальное поведение: для каждого рендера сохраняется проверка `isCurrentRender(renderToken)` и нет "раннего return" из-за уже существующего shared promise, которое оставляло экран в skeleton.
- Анти-регрессия: `tests/e2e/app-smoke.spec.js` (`cold start without hash canonicalizes route and hydrates home`, `catalog route recovers hydration after delayed data load and route churn`).

### P1: двойная initial-обработка маршрута

- Статус: `Resolved`.
- Канонизация hash теперь через `history.replaceState`, без двойного `hashchange + manual processCurrentHash`.

### P1: таймерный redirect в auth-flow без lifecycle-привязки

- Статус: `Resolved`.
- Таймерный редирект удален; переход выполняется напрямую после успешного завершения verify/update.

### P2: дублирование ownership auth redirect

- Статус: `Resolved`.
- Redirect-решение централизовано в `auth-guard`, lock ownership вынесен в `auth-redirect-coordinator`.

### P2: фрагментация навигации через legacy `scripts/nav-auth.js`

- Статус: `Resolved`.
- Legacy модуль отсутствует; используется `scripts/app/ui/account-nav.js` + `navigateTo(...)`.

## 4) Актуальные риски

### P3 (низкий): legacy запись в SW shell precache

- В `sw.js` в `shellPrecacheUrls` остается `./scripts/nav-auth.js`, хотя файл удален.
- Фактически это не ломает install (ошибка на `cache.add` ловится), но создает шум в консоли и лишнюю попытку precache.
- Рекомендация:
  1. удалить путь из `shellPrecacheUrls`;
  2. повысить `SHELL_CACHE_NAME`, чтобы корректно инвалидировать старый cache namespace.

## 5) Итог

- Навигационная архитектура стабилизирована: критичных lifecycle-дефектов из аудита 2026-02-18 в текущем коде не выявлено.
- Функциональные regression-checks подтверждены e2e (`39 passed`).
- Остается низкоприоритетная техдолг-задача по cleanup Service Worker precache.
