# ADR: Semantic responsive image pipeline (`<picture>/<img>`)

- Date: 2026-02-16
- Status: Accepted
- Scope: image data contract, UI rendering, SW caching, image build tooling
- Policy: `behavior-change`

## Контекст

До рефакторинга контентные обложки рендерились через `background-image`, а источники обложек хранились как внешние URL в `data.json`.

Проблемы:

- слабая семантика и доступность для контентных изображений;
- нет управляемого `srcset/sizes` и явных `width/height`;
- высокая зависимость от внешних доменов;
- ограниченная оффлайн-совместимость для изображений.

## Решение

В проекте принят единый responsive image pipeline:

1. Хранение source ассетов в репозитории:

- `assets/images/src/materials/<id>/cover.jpg`
- `assets/images/src/home/hero.jpg`

2. Генерация производных ассетов через `sharp`:

- `npm run images:build`
- cover: `160/240/320/480w` (`2:3`)
- hero: `640/960/1280w` (`8:3`)
- форматы: `webp` (q=72) + `jpg` (q=78, progressive mozjpeg)

3. Новый data-contract (breaking):

- `materials[].cover` теперь объект:
  - `asset`
  - `alt`
  - `focalPoint` (optional)

4. UI-рендер:

- контентные изображения выводятся через `<picture><source type="image/webp"> + <img>`;
- используется helper `scripts/app/ui/responsive-image.js` с preset-ами:
  - `coverCarousel`
  - `coverCatalog`
  - `coverDetail`
  - `homeHero`

5. Service Worker:

- разделение cache на shell и images:
  - `catalog-mvp-shell-v16`
  - `catalog-mvp-images-v16`
- runtime image cache для `/assets/images/generated/` по стратегии `stale-while-revalidate`.

## Было / Стало

| Было | Стало |
|---|---|
| `cover` как URL-строка в `data.json` | `cover` как объект (`asset/alt/focalPoint`) |
| `background-image` для обложек | semantic `<picture>/<img>` |
| Нет локального image-pipeline | `sharp` build/check scripts |
| Единый cache в SW | shell + image runtime cache |

## Budget-контроль

Добавлена команда `npm run images:check`:

- проверяет наличие source и generated ассетов;
- валидирует лимиты размеров:
  - Cover WebP: `160<=18KB`, `240<=28KB`, `320<=40KB`, `480<=65KB`
  - Hero WebP: `640<=70KB`, `960<=120KB`, `1280<=180KB`
  - JPEG лимиты: `+35%` к WebP лимитам.

## Тестирование

- обновлен `tests/e2e/app-smoke.spec.js`:
  - проверка hero `<img>` (`fetchpriority`, `width/height`);
  - проверка рендера обложек через `<img>`;
  - проверка отсутствия inline `background-image` для контентных обложек.

## Риски и дальнейшие шаги

- Риск: нарушение budget-лимитов при замене исходников.
- Риск: пропуск `npm run images:build` перед деплоем.

Рекомендуемые шаги:

1. Добавить CI job: `npm run images:build && npm run images:check && npm run test:e2e`.
2. Вынести image preset-ы в общий конфиг для browser/runtime и tooling.
3. При необходимости добавить AVIF как дополнительный source для современных браузеров.
