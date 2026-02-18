# Шпаргалка по image workflow

В проекте два типа ассетов:

- `assets/images/src/*` - исходники (`.jpg`), редактируются вручную.
- `assets/images/generated/*` - производные размеры (`.webp` + `.jpg`), генерируются скриптом.

Контентные изображения в UI идут через `<picture>/<img>`. Для обложек и hero `background-image` не используется.

## Быстрые команды

```bash
npm run images:build
npm run images:check
npm run test:e2e
```

- `images:build` генерирует все варианты из `data.json` + `home/hero`.
- `images:check` валидирует контракт `cover`, наличие файлов, budgets и геометрию.
- `test:e2e` проверяет, что визуально и роутинг не сломались.
- Запускать последовательно: сначала `build`, потом `check`.

## 1) Добавить новый материал с обложкой

### Шаг 1. Положить source

Путь:

```text
assets/images/src/materials/<ID>/cover.jpg
```

Важно:

- только `cover.jpg`;
- только `.jpg`;
- `generated` вручную не редактируется.

### Шаг 2. Добавить материал в `data.json`

`cover` обязан быть объектом:

```json
"cover": {
  "asset": "materials/7/cover",
  "alt": "Обложка материала «Название материала»",
  "focalPoint": "50% 50%"
}
```

Правила:

- `cover.asset` обязателен и начинается с `materials/`;
- `cover.alt` обязателен;
- `cover.focalPoint` опционален, если есть - только строка.

### Шаг 3. Сгенерировать варианты

```bash
npm run images:build
```

Для cover генерируются:

- `160/240/320/480w`
- ratio `3:4` (`160x213`, `240x320`, `320x427`, `480x640`)
- форматы `.webp` и `.jpg`

### Шаг 4. Проверить

```bash
npm run images:check
```

### Шаг 5. Проверить UI

```bash
npm run test:e2e
```

## 2) Заменить обложку существующего материала

1. Заменить `assets/images/src/materials/<ID>/cover.jpg`.
2. При необходимости обновить `cover.alt` и `cover.focalPoint` в `data.json`.
3. Запустить:

```bash
npm run images:build
npm run images:check
```

4. Проверить карточку в `#/catalog` и страницу `#/material/<ID>`.

## 3) Обновить hero на главной

### Шаг 1. Заменить source

```text
assets/images/src/home/hero.jpg
```

### Шаг 2. Перегенерировать

```bash
npm run images:build
npm run images:check
```

Для hero генерируются `640/960/1280w` в `.webp` и `.jpg` с ratio `8:3`.

### Шаг 3. Проверить главную

- открыть `#/`;
- убедиться, что баннер корректен на мобильной и десктопной ширине.

## 4) Что обязательно коммитить

- `data.json` (если менялись материалы/`cover.*`);
- `assets/images/src/...`;
- `assets/images/generated/...`.

`generated`-файлы считаются частью результата и коммитятся вместе с source.

## 5) Частые ошибки

### `Отсутствует source изображение: ...`

Проблема: нет исходника `cover.jpg`/`hero.jpg` в ожидаемом пути.

### `cover.asset должен начинаться с "materials/"`

Проблема: неверный `cover.asset` в `data.json`.

### `поле cover.alt обязательно`

Проблема: не заполнен `alt` у материала.

### `cover.focalPoint должен быть строкой`

Проблема: у `cover.focalPoint` неверный тип.

### `Некорректная геометрия ...`

Проблема: generated-файл имеет неверные width/height для заданного ratio.

### `Превышен budget WEBP/JPEG ...`

Проблема: итоговый файл слишком тяжелый.
Решение: оптимизировать source и снова выполнить `images:build`.

### В браузере отображается старая картинка

Проблема: кэш браузера или Service Worker.
Решение: hard refresh (`Ctrl+F5`) или очистка site data в DevTools.

## 6) Чеклист перед пушем

1. `npm run images:build`
2. `npm run images:check`
3. `npm run test:e2e`
4. Ручная проверка `#/`, `#/catalog`, `#/material/<id>`
