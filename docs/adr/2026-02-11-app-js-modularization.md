# ADR: Модульный рефакторинг `scripts/app.js`

- Date: 2026-02-11
- Status: Accepted
- Scope: `scripts/app.js` + интеграционные точки (`index.html`, `sw.js`, test tooling, docs)
- Policy: `no-behavior-change`

## Контекст

`scripts/app.js` вырос до монолитного файла (~1700 строк), который одновременно управлял:

- hash-router и навигацией
- загрузкой `data.json`
- auth-gating и сценариями recovery
- рендерами всех экранов
- platform-логикой (orientation guard, SW registration)

Такой формат усложнял поддержку, точечные изменения и безопасное покрытие e2e.

## Решение

Код декомпозирован на ESM-модули с разделением ответственности:

- `scripts/app.js` -> только entrypoint (`initApp`)
- `scripts/app/bootstrap.js` -> инициализация и wiring
- `scripts/app/routing/*` -> hash parsing, navigation, route orchestration
- `scripts/app/views/*` -> отдельные экраны
- `scripts/app/services/*` -> auth/data доступ
- `scripts/app/ui/*` -> shell + placeholders
- `scripts/app/platform/*` -> platform-specific логика
- `scripts/app/state.js` -> единый runtime state

Подключение `scripts/app.js` в `index.html` переведено на `type="module"`.

## Было / Стало

| Было | Стало |
|---|---|
| Один файл `scripts/app.js` со всем приложением | Набор ESM-модулей в `scripts/app/*` |
| Неявные внутренние зависимости в пределах IIFE | Явные `import/export` между модулями |
| Нет автоматических e2e smoke тестов | Playwright smoke suite (`tests/e2e/app-smoke.spec.js`) |
| `sw.js` pre-cache только монолитного app.js | `sw.js` pre-cache entrypoint + все ESM зависимости |

## Гарантии сохранения поведения

- Маршруты и redirect-контракты сохранены:
  - `#/`, `#/catalog`, `#/material/:id`, `#/auth`, `#/account`
  - неизвестные/невалидные маршруты -> `#/`
  - auth redirect через `#/auth?redirect=...`
- `window.authStore` и `window.supabaseClient` остаются единственными источниками auth/session данных.
- Контент, тексты, CSS-классы и ключевые DOM id экранов не изменялись намеренно.
- Функциональные улучшения/изменения UX вне плана не вносились.

## Влияние на PWA

- Версия SW-кэша повышена: `catalog-mvp-v13` -> `catalog-mvp-v14`.
- В pre-cache добавлены все ESM-файлы из `scripts/app/*`.

## Тестирование

### Добавлено

- `package.json` с devDependency `@playwright/test`
- `playwright.config.js` с локальным `webServer` (`python -m http.server 4173`)
- smoke-тесты в `tests/e2e/app-smoke.spec.js`

### Выполненные команды (2026-02-11)

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

### Результат

- `7 passed` (Chromium)
- Пройденные сценарии:
  - home render + materials load
  - catalog search/filter
  - material guest CTA redirect
  - account auth-gating
  - forgot mode render
  - unknown route redirect
  - bottom nav active-state sanity

## Риски и дальнейшие шаги

- Риск: появление новых файлов требует поддерживать актуальный список в `sw.js`.
- Риск: при расширении auth-flow возможны регрессии в cross-module связках.

Рекомендуемые шаги:

1. Добавить CI job для `npm run test:e2e` на каждый PR.
2. Добавить unit-тесты для `scripts/app/routing/hash.js`.
3. Рассмотреть вынос общих auth validation helpers в отдельный модуль с unit-тестами.
