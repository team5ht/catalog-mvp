# ADR: Auth MVP v2 (`login/signup/reset`) с OTP-first

- Date: 2026-02-20
- Status: Accepted
- Scope: `scripts/app/constants.js`, `scripts/app/routing/*`, `scripts/app/services/auth-service.js`, `scripts/app/views/auth-view.js`, `tests/e2e/*`, `README.md`
- Policy: `behavior-change`

## Контекст

Текущий auth-flow использовал `mode=login|forgot` и legacy `mode=recovery`, а также старую 3-шаговую OTP recovery ветку с персистом stage в `localStorage`.

Для MVP v2 нужно:

1. Явно разделить режимы `login/signup/reset`.
2. Перевести регистрацию на OTP-first без `signUp()`.
3. Для reset использовать recovery OTP без reset-ссылок.
4. Добавить cooldown отправки OTP и лимит verify-попыток.
5. Не хранить Stage 2 в persistent storage.

## Решение

1. Режимы auth:
2. Поддерживаются только `mode=login|signup|reset`.
3. Неизвестный mode нормализуется в `login`.

4. Регистрация:
5. `signInWithOtp({ email, options: { shouldCreateUser: true } })`
6. `verifyOtp({ email, token, type: 'email' })`
7. `updateUser({ password })`

8. Восстановление:
9. `resetPasswordForEmail(email)` (без `redirectTo`)
10. `verifyOtp({ email, token, type: 'recovery' })`
11. `updateUser({ password: newPassword })`

12. Ограничения:
13. Cooldown send/resend OTP: `60s`.
14. Лимит verify-ошибок OTP: `5`, далее только resend.
15. Stage 2 для `signup/reset` хранится только в памяти и сбрасывается после reload.

16. Безопасность:
17. `auth.signUp(...)` не используется.
18. Пароли/OTP не сохраняются в `localStorage/sessionStorage/IndexedDB`.
19. В сценарии `verifyOtp OK`, `updateUser FAIL` выполняется `signOut()` и flow сбрасывается в Stage 1.

## Последствия

1. Auth-flow стал согласованным и явно OTP-first для signup/reset.
2. Удалена зависимость от legacy `forgot/recovery` UX.
3. Снижен риск несогласованных стадий из-за персиста Stage 2.

## Тестирование

1. Обновлен `tests/e2e/auth-reset-otp.spec.js` под `mode=reset`.
2. Добавлен `tests/e2e/auth-signup-otp.spec.js` для `mode=signup`.
3. Обновлен `tests/e2e/navigation-auth-guards.spec.js` (authed редиректится из любого auth mode).
4. Обновлен `tests/e2e/app-smoke.spec.js` для новых auth mode.

## Implementation status update (2026-02-20)

1. `P1` из `docs/auth-flow-audit-2026-02-20.md` закрыт behavior-preserving рефактором в `scripts/app/views/auth-view.js`.
2. Для `signup/reset` удалены две отдельные OTP state-machine и внедрен единый внутренний контроллер `initOtpFlow(...)` с mode-specific `signupVariant/resetVariant`.
3. Внешний контракт не менялся: сохранены route/query contract, DOM id/data-action и пользовательские тексты.
4. Добавлен parity-тест `reload on signup stage 2 returns to stage 1` в `tests/e2e/auth-signup-otp.spec.js`.
5. Регрессия подтверждена полным прогоном `npm run test:e2e` (`36 passed`).
