# Аудит auth-flow (`login/signup/reset`) — 2026-02-20

## Контекст и методика

- Область проверки: `scripts/app/views/auth-view.js`, `scripts/app/services/auth-service.js`, `scripts/app/routing/auth-guard.js`, `scripts/app/routing/hash.js`, связанные e2e и документация.
- Формат: архитектурный и code-level аудит + проверка UX/UI + сверка документации.
- Факт-проверка через e2e:
  - `npx playwright test tests/e2e/auth-signup-otp.spec.js tests/e2e/auth-reset-otp.spec.js tests/e2e/navigation-auth-guards.spec.js tests/e2e/app-smoke.spec.js --reporter=line`
  - Результат: `35 passed`.

## Итог

- Критических функциональных поломок не выявлено.
- Новый OTP-first flow работает в заявленном happy-path и покрыт e2e базового уровня.
- Найдены архитектурные и UX/поддерживаемостные риски, которые стоит закрыть до следующего расширения auth-функциональности.

## Status update (2026-02-20)

- `P1` закрыт: в `scripts/app/views/auth-view.js` внедрен единый OTP-контроллер `initOtpFlow(...)` для `signup/reset` вместо двух отдельных state-machine, без изменения внешнего UI/API-контракта.
- Добавлен parity-тест `reload on signup stage 2 returns to stage 1` в `tests/e2e/auth-signup-otp.spec.js`.
- Валидация после рефакторинга:
  - `npm run test:e2e`
  - результат: `36 passed`.
- `P2` и `P3` из этого отчета остаются открытыми.

## Status update (2026-02-26)

- Закрыта часть `P2` про ownership redirect-lock: глобальный `window.__*` контракт удален.
- Введен явный app-level coordinator `scripts/app/services/auth-redirect-coordinator.js` (module-scope lock API).
- `scripts/app/views/auth-view.js` теперь пишет lock через coordinator, `scripts/app/routing/auth-guard.js` читает его через coordinator.
- Закрыт remaining `P2`: для `verify 429` добавлен локальный cooldown verify-кнопки с countdown и восстановлением фокуса в OTP input после backoff.
- Закрыты оба `P3`:
  - в reset-flow при invalid OTP очищается только OTP, новый пароль сохраняется;
  - в login удален дублирующий reset-CTA (оставлена одна ссылка).
- Добавлены e2e-анти-регрессы:
  - `tests/e2e/auth-reset-otp.spec.js`: verify-backoff и сохранение reset-пароля при invalid OTP;
  - `tests/e2e/auth-signup-otp.spec.js`: verify-backoff для signup;
  - `tests/e2e/app-smoke.spec.js`: проверка единственного reset-CTA в login.
- Валидация после изменения:
  - `npm run test:e2e`
  - результат: `39 passed`.

## Validation refresh (2026-02-26)

- Выполнена повторная валидация текущего workspace-состояния:
  - `npm run images:check` -> `Проверка изображений пройдена. Проверено ассетов: 14.`
  - `npm run test:e2e` -> `39 passed`.
- Дополнительных auth-регрессий относительно status update от 2026-02-26 не выявлено.

## Findings

### P1 (высокий, Resolved 2026-02-20): дублирование двух state-machine в `auth-view`

- Исторически дублировались отдельные signup/reset state-machine; в текущем коде заменены единым `initOtpFlow(...)`: `scripts/app/views/auth-view.js:332`, mode-variant wiring: `scripts/app/views/auth-view.js:753`, `scripts/app/views/auth-view.js:914`.
- Дублируются: cooldown-таймер, verify-attempts, stage-render, submit/click handlers, rate-limit обработка, части validation.
- Риск:
  - расхождение поведения между signup и reset при будущих правках;
  - рост стоимости изменений и тестов;
  - более высокий шанс точечных регрессий.
- Рекомендация:
  - выделить общий `createOtpFlowController(config)` с параметрами (`mode`, `copy`, `verifyType`, `requestFn`, `verifyFn`, `needPasswordOnVerify`).
  - оставить в `renderAuthView` только wiring и layout.

### P2 (средний, Resolved 2026-02-26): скрытая межмодульная связка через глобальный redirect-lock

- Новый coordinator: `scripts/app/services/auth-redirect-coordinator.js:1`.
- Запись lock из view: `scripts/app/views/auth-view.js:141`.
- Чтение lock в guard: `scripts/app/routing/auth-guard.js:14`.
- Риск:
  - неявный ownership между view и routing-layer;
  - усложнение диагностики при race-сценариях;
  - сложнее переиспользовать auth-guard без browser-global контрактов.
- Рекомендация:
  - инкапсулировать флаг в `auth-service`/`auth-session-coordinator` (module-scope API), убрать прямой `window.__*` контракт.
  - добавить e2e-кейс на redirect ownership во время `verifyOtp -> updateUser`.

### P2 (средний, Resolved 2026-02-26): verify rate-limit не включает локальный cooldown

- Общая ветка `verify 429` в `initOtpFlow`: `scripts/app/views/auth-view.js:656`.
- При `verify 429` запускается отдельный локальный cooldown verify-кнопки (`Повтор через N c`), кнопка блокируется на backoff.
- Риск:
  - UI не ограничивает повторные verify-запросы локально;
  - лишняя нагрузка/шум в запросах до серверного лимитера.
- Рекомендация:
  - при verify 429 запускать cooldown так же, как на send/resend;
  - отключать verify на период backoff и возвращать фокус в OTP input после cooldown.

### P3 (низкий, Resolved 2026-02-26): UX-трение в reset-flow при неверном OTP

- На invalid/expired OTP очищается только OTP, новый пароль сохраняется: `scripts/app/views/auth-view.js:979`.
- Риск:
  - лишние действия пользователя при повторной попытке;
  - рост отказов на мобильных из-за повторного ввода длинного пароля.
- Рекомендация:
  - очищать только OTP, пароль оставлять (как минимум до смены email/перезапроса кода).

### P3 (низкий, Resolved 2026-02-26): дублирующий CTA в login-состоянии

- В login оставлена одна reset-ссылка в meta-блоке: `scripts/app/views/auth-view.js:182`.
- Удален скрываемый/показываемый дубль и связанная ветка `showResetCta`.
- Риск:
  - визуальный шум и избыточная логика `showResetCta`.
- Рекомендация:
  - оставить один reset-CTA и убрать дубль/`showResetCta` ветку.

## Легаси и документация

- `README` синхронизирован с текущим e2e-покрытием (`auth-signup-otp`/`auth-reset-otp`/guard-сценарии).
- ADR `docs/adr/2026-02-12-auth-recovery-otp.md` имеет статус `Superseded`; актуальный flow фиксируется ADR v2 (`2026-02-20`).

## Тестовое покрытие: что добавить

1. Signup: reload на stage 2 -> возврат в stage 1 (аналог reset-проверки). `Done 2026-02-20`.
2. Verify-rate-limit: проверка запуска UI cooldown после 429. `Done 2026-02-26`.
3. Redirect ownership: сценарий `verifyOtp success` + искусственная задержка `updateUser`, чтобы зафиксировать отсутствие двойных redirect и мерцаний.
4. Негативный redirect-параметр (`#/auth`, `#/unknown`, внешние схемы) для signup/reset success-path.

## План исправлений

1. Сначала (P1): убрать дублирование signup/reset в общий контроллер flow.
2. Затем (P2): вынести redirect-lock из `window` в явный app-level coordinator. `Done 2026-02-26`.
3. Затем (P2/P3): выровнять UX поведения verify-rate-limit и reset-invalid-OTP. `Done 2026-02-26`.
4. После рефакторинга: дополнить e2e-кейсы из блока выше.
