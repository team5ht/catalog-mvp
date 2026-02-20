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

## Findings

### P1 (высокий, Resolved 2026-02-20): дублирование двух state-machine в `auth-view`

- Повторяющиеся блоки signup/reset: `scripts/app/views/auth-view.js:345` и `scripts/app/views/auth-view.js:735`.
- Дублируются: cooldown-таймер, verify-attempts, stage-render, submit/click handlers, rate-limit обработка, части validation.
- Риск:
  - расхождение поведения между signup и reset при будущих правках;
  - рост стоимости изменений и тестов;
  - более высокий шанс точечных регрессий.
- Рекомендация:
  - выделить общий `createOtpFlowController(config)` с параметрами (`mode`, `copy`, `verifyType`, `requestFn`, `verifyFn`, `needPasswordOnVerify`).
  - оставить в `renderAuthView` только wiring и layout.

### P2 (средний): скрытая межмодульная связка через глобальный redirect-lock

- Запись глобального флага: `scripts/app/views/auth-view.js:134`.
- Чтение в guard: `scripts/app/routing/auth-guard.js:13`.
- Риск:
  - неявный ownership между view и routing-layer;
  - усложнение диагностики при race-сценариях;
  - сложнее переиспользовать auth-guard без browser-global контрактов.
- Рекомендация:
  - инкапсулировать флаг в `auth-service`/`auth-session-coordinator` (module-scope API), убрать прямой `window.__*` контракт.
  - добавить e2e-кейс на redirect ownership во время `verifyOtp -> updateUser`.

### P2 (средний): verify rate-limit не включает локальный cooldown

- Signup verify: `scripts/app/views/auth-view.js:642`.
- Reset verify: `scripts/app/views/auth-view.js:1017`.
- Сейчас на 429 показывается сообщение с секундами, но не запускается `startOtpCooldown(...)` для verify-кнопки.
- Риск:
  - UI не ограничивает повторные verify-запросы локально;
  - лишняя нагрузка/шум в запросах до серверного лимитера.
- Рекомендация:
  - при verify 429 запускать cooldown так же, как на send/resend;
  - отключать verify на период backoff и возвращать фокус в OTP input после cooldown.

### P3 (низкий): UX-трение в reset-flow при неверном OTP

- На invalid/expired OTP очищается и OTP, и новый пароль: `scripts/app/views/auth-view.js:1025`.
- Риск:
  - лишние действия пользователя при повторной попытке;
  - рост отказов на мобильных из-за повторного ввода длинного пароля.
- Рекомендация:
  - очищать только OTP, пароль оставлять (как минимум до смены email/перезапроса кода).

### P3 (низкий): дублирующий CTA в login-состоянии

- В meta-блоке уже есть постоянная ссылка на reset: `scripts/app/views/auth-view.js:189`.
- Дополнительно есть скрываемая/показываемая ссылка с тем же назначением: `scripts/app/views/auth-view.js:190`.
- Риск:
  - визуальный шум и избыточная логика `showResetCta`.
- Рекомендация:
  - оставить один reset-CTA и убрать дубль/`showResetCta` ветку.

## Легаси и документация

- В `README` был частичный рассинхрон по списку e2e (не был перечислен `auth-signup-otp`).
- ADR `docs/adr/2026-02-12-auth-recovery-otp.md` оставался со статусом `Accepted`, хотя текущий flow уже заменен ADR v2 (`2026-02-20`).

## Тестовое покрытие: что добавить

1. Signup: reload на stage 2 -> возврат в stage 1 (аналог reset-проверки). `Done 2026-02-20`.
2. Verify-rate-limit: проверка запуска UI cooldown после 429.
3. Redirect ownership: сценарий `verifyOtp success` + искусственная задержка `updateUser`, чтобы зафиксировать отсутствие двойных redirect и мерцаний.
4. Негативный redirect-параметр (`#/auth`, `#/unknown`, внешние схемы) для signup/reset success-path.

## План исправлений

1. Сначала (P1): убрать дублирование signup/reset в общий контроллер flow.
2. Затем (P2): вынести redirect-lock из `window` в явный app-level coordinator.
3. Затем (P2/P3): выровнять UX поведения verify-rate-limit и reset-invalid-OTP.
4. После рефакторинга: дополнить e2e-кейсы из блока выше.
