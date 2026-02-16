# Шпаргалка: как работать с изображениями

Коротко: в проекте есть **source-картинки** и **generated-картинки**.

- `assets/images/src/*` - исходники (`.jpg`), редактируете вы.
- `assets/images/generated/*` - сгенерированные размеры (`.webp` + `.jpg`), создаются скриптом.

Контентные изображения в UI рендерятся через `<picture>/<img>`, поэтому `background-image` для обложек больше не используется.

## Быстрые команды

```bash
npm run images:build
npm run images:check
npm run test:e2e
```

- `images:build` - генерирует все варианты изображений.
- `images:check` - проверяет, что всё на месте и не превышены лимиты веса.
- `test:e2e` - smoke-проверка, что UI не сломался.

## 1) Добавить новый материал с новой обложкой

### Шаг 1. Положите source-обложку

Путь строго такой:

```text
assets/images/src/materials/<ID>/cover.jpg
```

Пример для `id = 7`:

```text
assets/images/src/materials/7/cover.jpg
```

Важно:

- только `.jpg` (скрипт ищет именно `cover.jpg`);
- не кладите сразу в `generated`, этот каталог не редактируется вручную.

### Шаг 2. Добавьте материал в `data.json`

Поле `cover` теперь объект, не строка:

```json
"cover": {
  "asset": "materials/7/cover",
  "alt": "Обложка материала «Название материала»",
  "focalPoint": "50% 50%"
}
```

Правила:

- `cover.asset` обязан начинаться с `materials/`;
- `cover.alt` обязателен;
- `cover.focalPoint` можно не указывать, тогда будет `50% 50%`.

### Шаг 3. Сгенерируйте варианты

```bash
npm run images:build
```

Для обложек генерируются размеры: `160/240/320/480w` (в `.webp` и `.jpg`).

### Шаг 4. Проверьте

```bash
npm run images:check
```

### Шаг 5. Финальная проверка UI

```bash
npm run test:e2e
```

## 2) Заменить обложку существующего материала

1. Замените файл `assets/images/src/materials/<ID>/cover.jpg`.
2. При необходимости обновите `alt`/`focalPoint` в `data.json`.
3. Выполните:

```bash
npm run images:build
npm run images:check
```

4. Проверьте в браузере страницу материала и каталог.

## 3) Обновить баннер на главной (hero)

### Шаг 1. Замените source-файл

```text
assets/images/src/home/hero.jpg
```

### Шаг 2. Перегенерируйте

```bash
npm run images:build
npm run images:check
```

Для hero генерируются размеры: `640/960/1280w` (в `.webp` и `.jpg`).

### Шаг 3. Проверьте главную

- откройте `#/`;
- убедитесь, что баннер выглядит корректно на мобильной и десктопной ширине.

## 4) Что коммитить в git

Коммитим вместе:

- изменения в `data.json` (если меняли материалы/alt/focalPoint);
- `assets/images/src/...` (новые/обновленные исходники);
- `assets/images/generated/...` (пересобранные варианты).

Не забывайте: generated-файлы - часть результата, их тоже нужно коммитить.

## 5) Частые ошибки и что делать

### Ошибка `Отсутствует source: ...`

Причина: нет source-файла по ожидаемому пути.  
Решение: проверьте путь и имя файла, должен быть `cover.jpg` или `hero.jpg`.

### Ошибка про `cover.asset must start with "materials/"`

Причина: неверный формат `cover.asset` в `data.json`.  
Решение: используйте шаблон `materials/<ID>/cover`.

### Ошибка про превышение budget

Причина: изображение слишком тяжелое после генерации.  
Решение: облегчите source (уменьшите детализацию/шум, переподготовьте файл) и снова `images:build`.

### В браузере старая картинка

Причина: кэш браузера или Service Worker.  
Решение: hard refresh (`Ctrl+F5`) или очистка site data в DevTools.

## 6) Мини-чеклист перед пушем

1. `npm run images:build`
2. `npm run images:check`
3. `npm run test:e2e`
4. Проверить руками `#/`, `#/catalog`, `#/material/<id>`
