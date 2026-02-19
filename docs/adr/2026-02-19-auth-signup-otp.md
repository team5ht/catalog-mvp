# ADR: Переход регистрации на OTP-код внутри PWA

- Date: 2026-02-19
- Status: Accepted
- Scope: `scripts/app/views/auth-view.js`, `scripts/app/services/auth-service.js`, `scripts/app/routing/hash.js`, `scripts/app/constants.js`, e2e tests, docs
- Policy: `behavior-change`

## Контекст

Регистрация через email-ссылку требовала открытия external-link из письма.  
В установленной PWA этот flow не является надежным: ссылка не возвращает пользователя в standalone-контекст приложения.

## Решение

Регистрация переведена на OTP flow внутри `#/auth?mode=signup`:

1. Пользователь вводит email и запрашивает код.
2. Вводит OTP из письма.
3. Задает пароль в приложении.
4. Аккаунт создается, пользователь остается в сессии и перенаправляется в `redirect` (если задан), иначе в `#/account`.

Логин `email + пароль` остается основным входом.

Техническая цепочка Supabase:

- `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
- `supabase.auth.verifyOtp({ email, token, type: 'email' })`
- `supabase.auth.updateUser({ password })`

## Изменения контрактов

- Добавлен auth-mode: `#/auth?mode=signup` (`register` нормализуется в `signup`).
- Удалена runtime-ветка регистрации через `supabase.auth.signUp({ email, password })` из login-экрана.
- Добавлены `localStorage` ключи signup-flow:
  - `catalog.auth.signupFlow`
  - `catalog.auth.signupOtpCooldownUntil`
- Добавлены новые auth-service helper-методы:
  - `requestSignupOtp(email, options)`
  - `verifySignupOtp(params)`

## Последствия

- Регистрация стала полностью in-app для PWA.
- Исключена зависимость от email-links в регистрации.
- Логика signup/recovery использует единые OTP-ограничения (6-8 цифр, cooldown 60 сек).

## Тестирование

Добавлены/обновлены e2e сценарии:

- smoke-проверка `mode=signup` и login-only UI.
- `tests/e2e/auth-signup-otp.spec.js`:
  - request OTP success/cooldown
  - verify OTP success/invalid
  - update password success (redirect/default redirect)
  - 429 на request/verify
- `tests/e2e/navigation-auth-guards.spec.js`:
  - authed opening `mode=signup` redirect behavior.
