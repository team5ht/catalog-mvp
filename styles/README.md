# Стили проекта: актуальное состояние

Этот файл описывает фактическое состояние CSS в `styles/` и порядок подключения в HTML. Он синхронизирован с текущим кодом и предназначен для точного ориентирования в структуре и содержимом стилей.

## 1) Состав папки `styles/`

```
styles/
  base.css
  tokens.css
  tokens.theme-linear.css
  DESIGN-CODE.md
  README.md (этот файл)
  components/
    buttons.css
    cards.css
    navigation.css
    scroll-containers.css
  pages/
    account.css
    catalog.css
    login.css
    material.css
```

## 2) Порядок подключения CSS в HTML (фактический)

Все страницы подключают стили вручную, без сборщика. Порядок критичен: сначала токены, затем тема, затем базовые стили, затем компоненты, затем стили конкретной страницы.

- `account.html`
  1. `styles/tokens.css`
  2. `styles/tokens.theme-linear.css`
  3. `styles/base.css`
  4. `styles/components/buttons.css`
  5. `styles/components/navigation.css`
  6. `styles/pages/account.css`

- `auth-login.html`
  1. `styles/tokens.css`
  2. `styles/tokens.theme-linear.css`
  3. `styles/base.css`
  4. `styles/components/buttons.css`
  5. `styles/pages/login.css`

- `index.html`
  1. `styles/tokens.css`
  2. `styles/tokens.theme-linear.css`
  3. `styles/base.css`
  4. `styles/components/buttons.css`
  5. `styles/components/cards.css`
  6. `styles/components/scroll-containers.css`
  7. `styles/components/navigation.css`

- `catalog.html`
  1. `styles/tokens.css`
  2. `styles/tokens.theme-linear.css`
  3. `styles/base.css`
  4. `styles/components/buttons.css`
  5. `styles/components/cards.css`
  6. `styles/components/scroll-containers.css`
  7. `styles/components/navigation.css`
  8. `styles/pages/catalog.css`

- `material.html`
  1. `styles/tokens.css`
  2. `styles/tokens.theme-linear.css`
  3. `styles/base.css`
  4. `styles/components/buttons.css`
  5. `styles/components/navigation.css`
  6. `styles/pages/material.css`

## 3) Документ дизайна

- `styles/DESIGN-CODE.md` — отдельный дизайн-код (принципы, шкалы, ограничения, legacy-токены). Этот README фиксирует именно текущее состояние CSS-файлов, а дизайн-код — правила и намерения.

## 4) Токены (CSS Custom Properties)

### 4.1 `styles/tokens.css` — канонический набор

**Шрифты**
- `--font-family-sans`
- `--font-family-mono`

**Цвета: фон/поверхности**
- `--color-bg`
- `--color-surface`
- `--color-surface-muted`
- `--color-surface-translucent`

**Цвета: primary**
- `--color-primary`
- `--color-primary-hover`
- `--color-primary-soft`

**Цвета: текст**
- `--color-text`
- `--color-text-muted`
- `--color-text-on-primary`
- `--color-secondary-text`
- `--color-secondary-text-strong`

**Цвета: семантические/utility**
- `--color-danger`
- `--color-border`
- `--color-neutral-weak`
- `--color-neutral-weak-strong`
- `--color-placeholder`
- `--color-placeholder-disabled`
- `--color-cover-placeholder`

**Типографическая шкала**
- `--font-size-base`
- `--font-size-sm`
- `--font-size-lg`
- `--font-size-xl`
- `--font-size-2xl`
- `--font-size-3xl`

**Веса шрифта**
- `--font-weight-regular`
- `--font-weight-medium`
- `--font-weight-semibold`
- `--font-weight-bold`

**Радиусы**
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--radius-pill`

**Отступы (шкала)**
- `--space-xs`
- `--space-sm`
- `--space-md`
- `--space-lg`
- `--space-xl`
- `--space-2xl`

**Алиасы для отступов**
- `--space-1` (alias `--space-xs`)
- `--space-2` (alias `--space-sm`)
- `--space-3` (alias `--space-md`)
- `--space-4` (alias `--space-lg`)
- `--space-5` (alias `--space-xl`)
- `--space-6` (alias `--space-2xl`)

**Тени**
- `--shadow-none`
- `--shadow-subtle`
- `--shadow-card`
- `--shadow-press`
- `--shadow-strong`
- `--shadow-float`
- `--shadow-fab`

**Навигация / layout**
- `--bottom-nav-height`
- `--bottom-nav-icon-size`
- `--bottom-nav-spacing`
- `--bottom-nav-offset`
- `--page-horizontal-padding`

**Семантические алиасы**
- `--color-bg-page` → `--color-bg`
- `--color-bg-surface` → `--color-surface`
- `--color-bg-subtle` → `--color-surface-muted`
- `--color-text-primary` → `--color-text`
- `--color-text-secondary` → `--color-secondary-text`
- `--shadow-elevated` → `--shadow-card`
- `--shadow-floating` → `--shadow-float`
- `--shadow-button` → `--shadow-press`

### 4.2 `styles/tokens.theme-linear.css` — тема/оверрайды

Файл переопределяет часть токенов из `tokens.css` (включая базовый шрифт и цвета). Он подключается сразу после `tokens.css` и меняет фактический вид всех страниц.

**Переопределяется (полный список):**
- `--font-family-sans`
- `--color-bg`
- `--color-surface`
- `--color-surface-muted`
- `--color-surface-translucent`
- `--color-primary`
- `--color-primary-hover`
- `--color-primary-soft`
- `--color-text`
- `--color-text-muted`
- `--color-text-on-primary`
- `--color-secondary-text`
- `--color-secondary-text-strong`
- `--color-danger`
- `--color-border`
- `--color-neutral-weak`
- `--color-neutral-weak-strong`
- `--color-placeholder`
- `--color-placeholder-disabled`
- `--color-cover-placeholder`
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--shadow-subtle`
- `--shadow-card`
- `--shadow-press`
- `--shadow-strong`
- `--shadow-float`
- `--shadow-fab`

Остальные токены продолжают использоваться из `tokens.css` (типографическая шкала, spacing, `--radius-pill`, layout-токены и т.д.).

## 5) Базовые стили: `styles/base.css`

**Глобальные элементы и контейнеры**
- `body` — flex-колонка, `min-height: 100vh`, базовый шрифт/цвет/фон.
- `.app-shell` — общий контейнер приложения, flex-колонка и фон.
- `.app-container` — ограничение ширины до 640px и внутренние паддинги.
- `main` — основной контент; паддинги с учетом `--bottom-nav-offset` и safe-area.

**Секции и типографика**
- `.section`, `.section:last-child`
- `.page-title`
- `.section-title`
- `.section-subtitle`
- `.text-muted`

**Карточка/поверхность**
- `.card`
- `.card-header`

**Баннер главной**
- `.home-banner`
- `.home-banner__link`
- `.home-banner__image`

**Адаптив**
- `@media (max-width: 480px)` — уменьшенные паддинги `main`, корректировки баннера.

## 6) Переиспользуемые компоненты

### 6.1 `styles/components/buttons.css`

**Кнопки (`.button*`)**
- `.button`, `.button:hover`, `.button:active`, `.button:focus`
- `.button--primary`, `.button--primary:hover`, `.button--primary:active`, `.button--primary:focus-visible`
- `.button--secondary`
- `.button--download`
- `.button--download.is-loading` (скрывает кнопку при загрузке)

**Чипы/бейджи**
- `.chip`
- `.chip--interactive`, `.chip--interactive:hover`
- `.chip--interactive.chip--active`
- `.chip--tag`

### 6.2 `styles/components/cards.css`

- `.material-card` (карточка в горизонтальных каруселях)
- `.material-card--narrow` (фиксирует базовую ширину)
- `.material-card__cover` (обложка с `aspect-ratio: 2/3`)
- `@supports not (aspect-ratio: 2 / 3)` — fallback с `padding-top: 150%`
- `.material-card__title`
- `@media (max-width: 480px)` — уменьшение ширины карточки и размера заголовка

### 6.3 `styles/components/navigation.css`

- `.bottom-nav` (фиксированная нижняя панель)
- `.bottom-nav__button`
- `#nav-account.is-loading`, `.nav-account.is-loading` (скрывают кнопку аккаунта)
- `.bottom-nav__icon`, `.bottom-nav__icon *` (иконки с `stroke`/`fill`)
- `@media (hover: hover) and (pointer: fine)` — hover для иконок
- `.bottom-nav__button:focus-visible .bottom-nav__icon *`
- `.bottom-nav__button.bottom-nav__button--active .bottom-nav__icon *`
- `.bottom-nav__text-button`
- `.bottom-nav__text-button:focus-visible`
- `.bottom-nav__text-button--visible` (делает текстовую кнопку видимой)

### 6.4 `styles/components/scroll-containers.css`

**Горизонтальные карусели**
- `.materials-section`
- `.materials-section__header`
- `.materials-section__title`
- `.materials-carousel`, `.materials-carousel::-webkit-scrollbar`
- `@media (max-width: 480px)` — плотнее отступы и gap

**Категории каталога**
- `.catalog-categories`, `.catalog-categories::-webkit-scrollbar`
- `.catalog-categories__button`
- `.catalog-categories__button .chip`
- `.catalog-categories__button .chip.chip--active`
- `.catalog-categories__button:focus .chip.chip--active`

## 7) Стили конкретных страниц

### 7.1 `styles/pages/account.css`

- `.account-page` (паддинг сверху/снизу)
- `.account-header`
- `.account-kicker`
- `.account-subtitle`
- `.account-card` (границы + тень)
- `.account-identity`
- `.account-label`
- `.account-email` (крупная почта)
- `.account-actions`, `.account-actions .button`
- `.account-error`
- `.account-error--visible` (делает сообщение видимым)
- `.account-version`
- `@media (max-width: 480px)` — уменьшение размера `account-email`

### 7.2 `styles/pages/catalog.css`

- `.catalog-list`
- `.catalog-list--compact`
- `.catalog-card`
- `.catalog-card__cover`
- `.catalog-card__info`
- `.catalog-card__title`
- `.catalog-card__title-link`, `.catalog-card__title-link:hover`
- `.catalog-search`
- `.catalog-search__field`
- `.catalog-search__icon`
- `.catalog-search__input`
- `.catalog-search__input:disabled`
- `.catalog-search__input::placeholder`
- `.catalog-search__input:focus`
- `@media (max-width: 480px)` — компактные паддинги и уменьшенная обложка

### 7.3 `styles/pages/login.css`

- `.auth-page` (градиентный фон, центровка)
- `.auth-form`
- `.auth-form .button` (растягивание кнопки на ширину)
- `.auth-form__title`
- `.auth-form__subtitle`
- `.auth-form__input`
- `.auth-form__note`
- `.auth-form__paragraph`
- `.auth-form__input:focus`

### 7.4 `styles/pages/material.css`

- `body.material-page-body` (задаёт `--material-page-background` и фон)
- `.material-page` (обнуляет паддинг, учитывает `--bottom-nav-offset` и safe-area)
- `.material-page__back-button`, `:hover`, `:active` (фиксированная круглая кнопка)
- `.material-page__cover-wrapper`
- `.material-page__cover`
- `.material-page__content`
- `.material-download`
- `.material-page__title`
- `.material-page__section`
- `.material-page__section-title`
- `.material-page__description`
- `.material-page__tags`
- `.material-page__tag`
- `@media (max-width: 380px)` — уменьшение обложки, кнопки скачивания и заголовка

## 8) Legacy/неопределенные токены, фактически используемые в CSS

В коде есть ссылки на токены, которых нет в `tokens.css` и которые не переопределяются в `tokens.theme-linear.css`. Это важно учитывать, так как эти значения зависят от внешнего определения или оказываются `undefined`.

- `--color-hero-gradient-end` — используется в `styles/pages/login.css` для градиента `.auth-page`.
- `--shadow-soft` — используется в `styles/pages/catalog.css` для `.catalog-search__field`.
- `--shadow-hero` — используется в `styles/pages/material.css` для `.material-page__cover`.

## 9) Состояния и модификаторы (BEM-подход)

В проекте используется простой BEM-подход с модификаторами через `--` и состояниями через классы:

- Размер/вариант: `.material-card--narrow`, `.catalog-list--compact`.
- Состояние: `.chip--active`, `.button--download.is-loading`, `.account-error--visible`.
- Навигация: `.bottom-nav__button--active`, `.bottom-nav__text-button--visible`.
- Скрытие элементов при загрузке: `#nav-account.is-loading`, `.nav-account.is-loading`.

## 10) Рекомендация по переименованию `styles/README.md`

Файл уже не конфликтует с корневым `README.md`, так как лежит в другой папке. Тем не менее, чтобы избежать путаницы при поиске и ссылках, имеет смысл рассмотреть переименование на один из вариантов:

- `styles/STYLES.md`
- `styles/STYLE-GUIDE.md`
- `styles/README.styles.md`

Переименование не требуется функционально, но повышает читаемость и снижает риск открыть «не тот README» при навигации по проекту.
