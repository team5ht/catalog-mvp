# ADR: Переход с recovery-ссылок на OTP recovery в PWA

- Date: 2026-02-12
- Status: Superseded (2026-02-20)
- Scope: `scripts/app/views/auth-view.js`, `scripts/app/routing/*`, `scripts/app/constants.js`, `scripts/app/services/auth-service.js`, e2e tests, docs
- Policy: `behavior-change`

> Superseded by `docs/adr/2026-02-20-auth-mvp-v2-otp-first.md` (введены режимы `login/signup/reset`, удален legacy `forgot/recovery` UX и persistence flow-state).

## Контекст

Старый recovery flow требовал открытия ссылки из email (`resetPasswordForEmail` + `redirectTo` + callback marker в URL).  
Для установленной PWA это давало фрагментированный UX: переходы между приложением и браузером.

## Решение

Восстановление пароля переведено на OTP flow внутри `#/auth?mode=forgot`:

1. Пользователь вводит email и запрашивает код.
2. Вводит OTP из письма (6-8 цифр, в зависимости от настройки провайдера/Auth).
3. Задает новый пароль в том же экране.

Техническая цепочка Supabase:

- `supabase.auth.resetPasswordForEmail(email)` (без `redirectTo`)
- `supabase.auth.verifyOtp({ email, token, type: 'recovery' })`
- `supabase.auth.updateUser({ password })`

## Изменения контрактов

- `#/auth?mode=recovery` больше не отдельный recovery-режим.
- `#/auth?mode=recovery` автоматически нормализуется в `#/auth?mode=forgot` с информированием пользователя.
- Search marker `?auth_mode=recovery` удален из роутинга.
- В `localStorage` используется новая модель состояния восстановления:
  - cooldown key: `catalog.auth.passwordResetOtpCooldownUntil`
  - flow key: `catalog.auth.passwordResetFlow`
- Старый cooldown key `catalog.auth.forgotCooldownUntil` мигрируется/очищается при первом входе в OTP flow.

## Последствия

- UX восстановления пароля стал полностью in-app для PWA.
- Роутинг и runtime state упрощены: удалены recovery-marker и `recoveryFlowActive`.
- Добавлены отдельные e2e сценарии с mock Supabase для проверки OTP веток и rate-limit.

## Тестирование

Обновлены smoke-сценарии:

- `#/auth?mode=forgot` рендерит OTP stepper
- `#/auth?mode=recovery` ведет в OTP flow

Добавлены e2e OTP-сценарии:

- request OTP success
- verify OTP success/invalid
- update password success
- 429 на recover/verify
