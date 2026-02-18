# Аудит архитектуры навигации и lifecycle экранов

Дата: 2026-02-18  
Область: `scripts/app/routing/*`, `scripts/app/bootstrap.js`, `scripts/app/state.js`, `scripts/app/views/*`, `scripts/nav-auth.js`  
Целевой контекст: hash-SPA/PWA каталог с auth-flow и OTP recovery (`README.md`).

## 1) Что проанализировано

- Роутинг/навигация: `scripts/app/routing/hash.js`, `scripts/app/routing/navigation.js`, `scripts/app/routing/router.js`.
- Runtime-state/history/lifecycle-токены: `scripts/app/state.js`.
- Инициализация приложения и глобальные подписки: `scripts/app/bootstrap.js`.
- Lifecycle экранов: `scripts/app/views/home-view.js`, `scripts/app/views/catalog-view.js`, `scripts/app/views/material-view.js`, `scripts/app/views/auth-view.js`, `scripts/app/views/account-view.js`.
- Внешний слой навигации аккаунта: `scripts/nav-auth.js`.
- Фактическое поведение подтверждено прогоном `npm run test:e2e` (20/20 passed) и дополнительными сценариями воспроизведения.

## 2) Текущее состояние архитектуры

### 2.1 Схема навигации (as-is)

1. Точка входа `scripts/app.js` вызывает `initApp()`.
2. В `scripts/app/bootstrap.js`:
   - вешаются обработчики статической навигации, hash-anchor перехват, auth-listener, orientation guard, SW;
   - назначается `replaceNavigationHandler` для `navigateTo(..., { replace: true })`;
   - обрабатывается `hashchange` и прокидывается `historyMode` через `consumePendingHistoryMode`.
3. `processCurrentHash()` парсит hash (`scripts/app/routing/hash.js`) и отдает route в `applyRoute()`.
4. `applyRoute()`:
   - сохраняет route в state,
   - обновляет in-app history (`recordRouteVisit`),
   - применяет scroll policy,
   - применяет shell state,
   - диспетчеризует рендер в конкретный view.

### 2.2 Lifecycle экранов (as-is)

- `home`/`catalog`: "кешируемые" view-ноды + ленивый hydrate с module-level флагами (`*Hydrated`) и shared promise (`*LoadPromise`).
- `material`/`auth`/`account`: fresh render через `root.innerHTML` на каждую навигацию.
- Для async-веток используется `renderToken` (`isCurrentRender`) как защита от записи устаревшего результата в DOM.

### 2.3 Сильные стороны

- Четкая декомпозиция по слоям (routing/state/views/services/ui/platform), без монолита.
- Есть in-app history + pop/push/replace семантика (`scripts/app/state.js`) и e2e покрытие основных сценариев.
- Есть базовая защита от race-condition через `renderToken`.
- Контракты hash/redirect нормализованы и валидируются (`sanitizeRedirectHash`).

## 3) Найденные проблемы и риски

Ниже список по приоритету.

### P0 (критично): потеря гидрации `home/catalog` при смене renderToken во время shared-loading

**Где:**
- `scripts/app/views/home-view.js:103`, `scripts/app/views/home-view.js:107`, `scripts/app/views/home-view.js:109`
- `scripts/app/views/catalog-view.js:258`, `scripts/app/views/catalog-view.js:262`, `scripts/app/views/catalog-view.js:265`

**Суть:**
- Если `homeLoadPromise`/`catalogLoadPromise` уже существует, новый рендер просто `return`.
- Promise хранит `renderToken` первого запуска.
- Если route уже сменился и вернулся (новый token), resolve первой promise игнорируется из-за `!isCurrentRender(renderToken)`.
- В результате текущий экран может остаться в skeleton/`aria-busy=true` без повторной гидрации.

**Подтверждение:**
- Воспроизведено на cold start `/` (без `#/`): через 7 секунд `#/`, `aria-busy=true`, в `#main-materials` только skeleton.
- Воспроизведено для каталога при задержке `data.json` и быстрой навигации `catalog -> material -> catalog`: экран остается skeleton.

### P1 (высокий): двойная initial-обработка маршрута на входе без hash

**Где:**
- `scripts/app/bootstrap.js:110`, `scripts/app/bootstrap.js:115`, `scripts/app/bootstrap.js:116`, `scripts/app/bootstrap.js:119`

**Суть:**
- При `!window.location.hash` код сначала ставит `window.location.hash = HOME_HASH` (вызывает `hashchange`), а затем сразу делает `processCurrentHash({ historyMode: 'initial' })`.
- Получаются две почти одновременные route-обработки на старте.
- Это напрямую усиливает/триггерит P0 на `/`.

### P1 (высокий): таймерный redirect в auth-flow не привязан к lifecycle текущего экрана

**Где:**
- `scripts/app/views/auth-view.js:959`, `scripts/app/views/auth-view.js:960`

**Суть:**
- После успешной смены пароля ставится `setTimeout(... navigateTo('#/account', { replace: true }) ...)`.
- Таймер не отменяется при размонтировании и не проверяет `isCurrentRender(renderToken)`.
- Пользователь может уйти на другой route, но через ~550ms будет насильно возвращен на `#/account`.

**Подтверждение:**
- Воспроизведено: после `set_password` вручную перейти на `#/catalog` до 550ms -> фактический итоговый hash `#/account`.

### P2 (средний): дублирование auth-redirect логики в двух слоях (bootstrap + auth-view)

**Где:**
- `scripts/app/bootstrap.js:85`
- `scripts/app/views/auth-view.js:327`, `scripts/app/views/auth-view.js:403`, `scripts/app/views/auth-view.js:407`

**Суть:**
- Redirect из `auth` при аутентифицированном пользователе выполняется и в глобальном auth-listener, и в самом экране auth.
- Поведенчески чаще всего "работает", но создает двойной источник truth, усложняет reasoning по lifecycle и увеличивает вероятность race/лишних re-render.

### P2 (средний): фрагментация навигационного слоя (legacy-style `nav-auth.js` в обход routing API)

**Где:**
- `scripts/nav-auth.js:68`, `scripts/nav-auth.js:76`, `scripts/nav-auth.js:81`
- в сравнении с централизованной навигацией `scripts/app/routing/navigation.js:37`

**Суть:**
- `nav-auth.js` напрямую пишет `window.location.hash`, имеет собственные helper-правила маршрутов (`buildAuthHash`, `normalizeHashRoute`) и не использует `navigateTo`.
- Это дублирует часть routing-логики и расходится с централизованной моделью `historyMode/pending navigation`.
- Сейчас не ломает базовые кейсы, но повышает технический риск при расширении навигации.

### P3 (низкий): частично "мертвый" контракт скрытия нижней навигации

**Где:**
- `scripts/app/ui/shell.js:45` (только `nav.hidden = false`)

**Суть:**
- Явного `nav.hidden = true` в shell-state нет, хотя API подразумевает управление видимостью.
- Это не текущий дефект UX, но признак неполного/устаревшего контракта слоя shell.

## 4) Оценка необходимости рефакторинга

### Вывод

Рефакторинг **нужен**, но **точечный/эволюционный**, не rewrite.

- По текущему функционалу приложение в основном стабильно (e2e зеленые).
- Однако есть подтвержденные lifecycle-дефекты (P0/P1), которые не покрыты текущими тестами.
- Главный риск не в роутере как таковом, а в связке `shared async loading + renderToken + double init`.

### Приоритет рефакторинга

1. **Срочно (P0/P1)**: устранить ошибки lifecycle и старта.
2. **Следом (P2)**: унифицировать routing/auth-redirect ownership.
3. **Планово (P3)**: дочистка shell-контрактов и уменьшение дублирования.

## 5) Рекомендованный план изменений

### !ВЫПОЛНЕНО! Этап A: Стабилизация lifecycle (обязательно) !ВЫПОЛНЕНО!

1. Убрать двойной initial route-pass в `bootstrap`:
   - либо после установки hash не вызывать `processCurrentHash` немедленно;
   - либо использовать единый путь инициализации без гонки `hashchange + manual`.
2. Пересобрать async-модель `home/catalog`:
   - shared loading оставить,
   - но каждый новый `renderToken` должен иметь шанс применить результат после resolve (не "теряться" из-за раннего `return`).
3. Для таймеров в `auth-view`:
   - хранить timeout id,
   - на callback делать `isCurrentRender(renderToken)` перед `navigateTo`,
   - очищать timeout при смене рендера/этапа.

### Этап B: Консолидация навигации (желательно)

1. Убрать дублирование auth-redirect в `bootstrap` и `auth-view`:
   - оставить единый владелец правила (предпочтительно guard-level в роутере).
2. Инкапсулировать логику `nav-auth.js` в модуль app-слоя:
   - использовать `navigateTo`,
   - исключить локальные копии hash-normalization/buildAuthHash.

### Этап C: Тесты для регрессий (обязательно после A)

Добавить e2e:
1. Cold start на `/` (без hash) должен гидратить home без skeleton freeze.
2. Быстрая навигация во время delayed `data.json` для `home` и `catalog`.
3. "Не украсть навигацию": после `set_password` уход на другой route не должен быть перетерт отложенным redirect.

## 6) Соответствие best practices и целевому функционалу

С учетом целевого функционала (легкий hash-SPA/PWA без bundler):

- Текущая архитектура **в целом соответствует** практике "малых модульных SPA".
- Наибольшее отклонение от best practice сейчас в **управлении жизненным циклом async-эффектов**, а не в выборе hash-router как подхода.
- После точечного рефакторинга этапа A система будет достаточно устойчивой для дальнейшего роста функционала без смены базовой архитектурной модели.

## 7) Итоговая оценка

- Текущее состояние: **работоспособно**, но с подтвержденными lifecycle-регрессиями в edge-сценариях.
- Необходимость рефакторинга: **высокая (точечная, не тотальная)**.
- Рекомендация: выполнить этап A до следующего функционального расширения навигации/auth-flow.
