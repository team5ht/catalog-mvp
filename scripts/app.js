(function() {
  const DATA_URL = 'data.json';
  const HOME_HASH = '#/';

  let appData = null;
  let authSession = null;
  let currentRoute = null;
  let currentRenderToken = 0;
  let catalogUiState = {
    categoryId: 0,
    query: ''
  };

  const inAppRouteHistory = [];

  function getSpaRoot() {
    return document.getElementById('spa-root');
  }

  function getBottomNav() {
    return document.querySelector('.bottom-nav');
  }

  function getSupabaseClient() {
    const client = window.supabaseClient;
    if (!client || !client.auth) {
      return null;
    }
    return client;
  }

  function isAuthenticated() {
    return Boolean(authSession && authSession.user);
  }

  async function refreshAuthSession() {
    const client = getSupabaseClient();
    if (!client || typeof client.auth.getSession !== 'function') {
      authSession = null;
      return null;
    }

    try {
      const { data } = await client.auth.getSession();
      authSession = data ? data.session : null;
    } catch (error) {
      console.warn('Не удалось получить сессию Supabase', error);
      authSession = null;
    }

    return authSession;
  }

  async function loadAppData() {
    if (appData) {
      return appData;
    }

    try {
      const response = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Response not ok: ${response.status}`);
      }

      const data = await response.json();
      appData = data;
      return data;
    } catch (error) {
      console.warn('Не удалось загрузить data.json', error);
      appData = null;
      throw error;
    }
  }

  function renderInlineError(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    container.setAttribute('aria-busy', 'false');
    container.innerHTML = '';
    const errorEl = document.createElement('p');
    errorEl.className = 'load-error';
    errorEl.textContent = message;
    container.appendChild(errorEl);
  }

  function renderMaterialsSkeleton(containerId, limit = 5) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    container.innerHTML = '';
    container.setAttribute('aria-busy', 'true');

    for (let i = 0; i < limit; i += 1) {
      const card = document.createElement('div');
      card.className = 'material-card material-card--narrow material-card--skeleton';
      card.setAttribute('aria-hidden', 'true');

      const cover = document.createElement('div');
      cover.className = 'material-card__cover skeleton';

      const title = document.createElement('p');
      title.className = 'material-card__title';

      const titleLine = document.createElement('span');
      titleLine.className = 'skeleton skeleton-line';
      title.appendChild(titleLine);

      card.appendChild(cover);
      card.appendChild(title);
      container.appendChild(card);
    }
  }

  function renderCategoriesSkeleton(limit = 5) {
    const container = document.getElementById('categories');
    if (!container) {
      return;
    }

    container.innerHTML = '';
    container.setAttribute('aria-busy', 'true');

    for (let i = 0; i < limit; i += 1) {
      const placeholder = document.createElement('span');
      placeholder.className = 'chip skeleton skeleton-chip';
      placeholder.setAttribute('aria-hidden', 'true');
      container.appendChild(placeholder);
    }
  }

  function renderCatalogSkeleton(limit = 4) {
    const container = document.getElementById('catalog-list');
    if (!container) {
      return;
    }

    container.innerHTML = '';
    container.setAttribute('aria-busy', 'true');

    for (let i = 0; i < limit; i += 1) {
      const card = document.createElement('article');
      card.className = 'catalog-card catalog-card--skeleton';
      card.setAttribute('aria-hidden', 'true');

      const cover = document.createElement('div');
      cover.className = 'catalog-card__cover skeleton';

      const info = document.createElement('div');
      info.className = 'catalog-card__info';

      const meta = document.createElement('span');
      meta.className = 'skeleton skeleton-line skeleton-line--meta';

      const title = document.createElement('span');
      title.className = 'skeleton skeleton-line skeleton-line--title';

      const tags = document.createElement('div');
      tags.className = 'catalog-card__tags';

      const chip1 = document.createElement('span');
      chip1.className = 'skeleton skeleton-chip';
      const chip2 = document.createElement('span');
      chip2.className = 'skeleton skeleton-chip';

      tags.appendChild(chip1);
      tags.appendChild(chip2);
      info.appendChild(meta);
      info.appendChild(title);
      info.appendChild(tags);

      card.appendChild(cover);
      card.appendChild(info);
      container.appendChild(card);
    }
  }

  function renderMaterialsCarousel(containerId, materials, limit = 5) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    container.innerHTML = '';
    container.setAttribute('aria-busy', 'false');

    (materials || []).slice(0, limit).forEach((material) => {
      const card = document.createElement('a');
      card.className = 'material-card material-card--narrow';
      card.title = material.title;
      card.href = `#/material/${material.id}`;

      const cover = document.createElement('div');
      cover.className = 'material-card__cover';
      cover.style.backgroundImage = `url(${material.cover})`;

      const title = document.createElement('p');
      title.className = 'material-card__title';
      title.textContent = material.title;

      card.appendChild(cover);
      card.appendChild(title);
      container.appendChild(card);
    });
  }

  function getCategoryNameById(categoryId) {
    if (!appData || !Array.isArray(appData.categories)) {
      return 'Материал';
    }

    const category = appData.categories.find((item) => item.id === categoryId);
    return category ? category.name : 'Материал';
  }

  function getFilteredCatalogMaterials() {
    if (!appData || !Array.isArray(appData.materials)) {
      return [];
    }

    const normalizedQuery = (catalogUiState.query || '').trim().toLowerCase();
    const selectedCategoryId = Number(catalogUiState.categoryId) || 0;

    return appData.materials.filter((material) => {
      const inCategory = selectedCategoryId === 0 || material.categoryId === selectedCategoryId;
      if (!inCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableContent = [
        material.title,
        material.description,
        Array.isArray(material.tags) ? material.tags.join(' ') : ''
      ]
        .join(' ')
        .toLowerCase();

      return searchableContent.includes(normalizedQuery);
    });
  }

  function renderCatalog(materials) {
    const container = document.getElementById('catalog-list');
    if (!container) {
      return;
    }

    container.innerHTML = '';
    container.setAttribute('aria-busy', 'false');

    (materials || []).forEach((material) => {
      const card = document.createElement('article');
      card.className = 'catalog-card';

      const coverLink = document.createElement('a');
      coverLink.className = 'catalog-card__cover';
      coverLink.style.backgroundImage = `url(${material.cover})`;
      coverLink.href = `#/material/${material.id}`;
      coverLink.setAttribute('aria-label', material.title);

      const info = document.createElement('div');
      info.className = 'catalog-card__info';

      const title = document.createElement('h3');
      title.className = 'catalog-card__title';

      const titleLink = document.createElement('a');
      titleLink.className = 'catalog-card__title-link';
      titleLink.href = `#/material/${material.id}`;
      titleLink.textContent = material.title;

      const meta = document.createElement('p');
      meta.className = 'catalog-card__meta';
      meta.textContent = getCategoryNameById(material.categoryId);

      title.appendChild(titleLink);
      info.appendChild(meta);
      info.appendChild(title);

      if (Array.isArray(material.tags) && material.tags.length > 0) {
        const tags = document.createElement('div');
        tags.className = 'catalog-card__tags';

        material.tags.slice(0, 2).forEach((tag) => {
          const tagEl = document.createElement('span');
          tagEl.className = 'chip chip--tag catalog-card__tag';
          tagEl.textContent = tag;
          tags.appendChild(tagEl);
        });

        info.appendChild(tags);
      }

      card.appendChild(coverLink);
      card.appendChild(info);
      container.appendChild(card);
    });

    if ((materials || []).length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'Ничего не найдено. Измените запрос или фильтр.';
      container.appendChild(emptyState);
    }
  }

  function syncActiveCategoryChip() {
    const selectedCategoryId = Number(catalogUiState.categoryId) || 0;

    document.querySelectorAll('.catalog-categories__button').forEach((button) => {
      const chip = button.querySelector('.chip');
      if (!chip) {
        return;
      }
      const isActive = Number(button.dataset.id) === selectedCategoryId;
      chip.classList.toggle('chip--active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function applyCatalogFilters() {
    if (!appData || !Array.isArray(appData.materials)) {
      return;
    }

    renderCatalog(getFilteredCatalogMaterials());
    syncActiveCategoryChip();
  }

  function renderCategories(categories) {
    const container = document.getElementById('categories');
    if (!container) {
      return;
    }

    container.innerHTML = '';
    container.setAttribute('aria-busy', 'false');

    (categories || []).forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'catalog-categories__button';
      button.dataset.id = String(category.id);
      button.setAttribute('aria-pressed', 'false');

      const chip = document.createElement('span');
      chip.className = 'chip chip--interactive';
      chip.textContent = category.name;
      button.appendChild(chip);

      button.addEventListener('click', () => {
        catalogUiState.categoryId = category.id;
        applyCatalogFilters();
      });

      container.appendChild(button);
    });

    syncActiveCategoryChip();
  }

  function parseQuery(queryString) {
    const params = new URLSearchParams(queryString || '');
    const query = {};

    params.forEach((value, key) => {
      query[key] = value;
    });

    return query;
  }

  function normalizeHash(inputHash) {
    if (!inputHash || inputHash === '#') {
      return HOME_HASH;
    }

    if (!inputHash.startsWith('#')) {
      return `#${inputHash}`;
    }

    if (inputHash === '#/') {
      return HOME_HASH;
    }

    return inputHash;
  }

  function parseHash(inputHash) {
    const fullHash = normalizeHash(inputHash);
    const rawHash = fullHash.slice(1);
    const [rawPath = '/', rawQuery = ''] = rawHash.split('?');
    const path = rawPath || '/';
    const query = parseQuery(rawQuery);

    if (path === '/') {
      return {
        name: 'home',
        params: {},
        query,
        path,
        fullHash
      };
    }

    if (path === '/catalog') {
      return {
        name: 'catalog',
        params: {},
        query,
        path,
        fullHash
      };
    }

    if (path === '/auth') {
      return {
        name: 'auth',
        params: {},
        query,
        path,
        fullHash
      };
    }

    if (path === '/account') {
      return {
        name: 'account',
        params: {},
        query,
        path,
        fullHash
      };
    }

    const materialMatch = path.match(/^\/material\/(\d+)$/);
    if (materialMatch) {
      return {
        name: 'material',
        params: {
          id: Number(materialMatch[1])
        },
        query,
        path,
        fullHash
      };
    }

    return {
      name: 'unknown',
      params: {},
      query,
      path,
      fullHash
    };
  }

  function sanitizeRedirectHash(candidate) {
    if (typeof candidate !== 'string') {
      return null;
    }

    const value = candidate.trim();
    if (!value.startsWith('#/')) {
      return null;
    }

    const parsed = parseHash(value);
    if (parsed.name === 'unknown') {
      return null;
    }

    return parsed.fullHash;
  }

  function buildAuthHash(redirectHash) {
    const params = new URLSearchParams();
    const safeRedirect = sanitizeRedirectHash(redirectHash);

    if (safeRedirect) {
      params.set('redirect', safeRedirect);
    }

    const query = params.toString();
    return query ? `#/auth?${query}` : '#/auth';
  }

  function updateBottomNavActive(routeName) {
    const navHome = document.getElementById('nav-home');
    const navCatalog = document.getElementById('nav-catalog');
    const navAccount = document.getElementById('nav-account');

    [navHome, navCatalog, navAccount].forEach((button) => {
      if (button) {
        button.classList.remove('bottom-nav__button--active');
      }
    });

    if (routeName === 'home' && navHome) {
      navHome.classList.add('bottom-nav__button--active');
    }

    if (routeName === 'catalog' && navCatalog) {
      navCatalog.classList.add('bottom-nav__button--active');
    }

    if ((routeName === 'account' || routeName === 'auth') && navAccount) {
      navAccount.classList.add('bottom-nav__button--active');
    }
  }

  function applyShellState(routeName) {
    const root = getSpaRoot();
    const nav = getBottomNav();

    if (!root) {
      return;
    }

    if (routeName === 'auth') {
      document.body.classList.add('fullscreen-static');
      root.className = '';
      return;
    }

    document.body.classList.remove('fullscreen-static');
    if (nav) {
      nav.hidden = false;
    }

    if (routeName === 'material') {
      root.className = 'material-page app-container';
      return;
    }

    if (routeName === 'account') {
      root.className = 'app-container account-page';
      return;
    }

    root.className = 'app-container';
  }

  function pushRouteHistory(hash) {
    const lastHash = inAppRouteHistory[inAppRouteHistory.length - 1];
    if (lastHash !== hash) {
      inAppRouteHistory.push(hash);
    }
  }

  function canGoBackInApp() {
    return inAppRouteHistory.length > 1;
  }

  function isCurrentRender(renderToken) {
    return renderToken === currentRenderToken;
  }

  function navigateTo(hash, options = {}) {
    const { replace = false } = options;
    const normalizedHash = normalizeHash(hash);

    if (replace) {
      const { pathname, search } = window.location;
      window.history.replaceState(null, '', `${pathname}${search}${normalizedHash}`);
      void processCurrentHash();
      return;
    }

    if (window.location.hash === normalizedHash) {
      return;
    }

    window.location.hash = normalizedHash;
  }

  function renderHomeView(renderToken) {
    const root = getSpaRoot();
    if (!root) {
      return;
    }
    root.setAttribute('aria-busy', 'true');

    root.innerHTML = `
      <header class="screen-header ui-enter">
        <p class="screen-header__kicker">5HT</p>
        <h1 class="page-title">Каталог материалов</h1>
        <p class="screen-header__subtitle text-body">Подборка переводов и практических материалов в едином мобильном каталоге.</p>
      </header>
      <section class="home-banner ui-enter">
        <a class="home-banner__link" href="https://forms.yandex.ru/u/68f26331f47e7388d5a2a27a/" target="_blank" rel="noopener noreferrer">
          <img class="home-banner__image" src="home-hero.png" alt="Баннер приглашения к участию" loading="lazy" />
          <div class="home-banner__content">
            <p class="home-banner__title">Предложите новый материал</p>
            <p class="home-banner__subtitle">Отправьте идею в каталог.</p>
          </div>
        </a>
      </section>
      <section class="materials-section ui-enter">
        <div class="materials-section__header">
          <h2 class="materials-section__title">Переводы</h2>
          <span class="materials-section__action">Подборка</span>
        </div>
        <div id="main-materials" class="materials-carousel"></div>
      </section>
      <section class="materials-section ui-enter">
        <div class="materials-section__header">
          <h2 class="materials-section__title">Материалы 5HT</h2>
          <span class="materials-section__action">Новое</span>
        </div>
        <div id="materials-5ht" class="materials-carousel"></div>
      </section>
    `;

    renderMaterialsSkeleton('main-materials', 5);
    renderMaterialsSkeleton('materials-5ht', 5);

    loadAppData()
      .then((data) => {
        if (!isCurrentRender(renderToken)) {
          return;
        }
        renderMaterialsCarousel('main-materials', data.materials);
        renderMaterialsCarousel('materials-5ht', data.materials);
        root.setAttribute('aria-busy', 'false');
      })
      .catch(() => {
        if (!isCurrentRender(renderToken)) {
          return;
        }
        renderInlineError('main-materials', 'Не удалось загрузить материалы.');
        renderInlineError('materials-5ht', 'Не удалось загрузить материалы.');
        root.setAttribute('aria-busy', 'false');
      });
  }

  function renderCatalogView(renderToken) {
    const root = getSpaRoot();
    if (!root) {
      return;
    }
    root.setAttribute('aria-busy', 'true');

    root.innerHTML = `
      <section class="catalog-shell">
        <header class="screen-header ui-enter">
          <p class="screen-header__kicker">Библиотека</p>
          <h1 class="page-title">Каталог</h1>
          <p class="screen-header__subtitle text-body">Фильтруйте материалы по категориям и быстро находите нужное по названию, описанию или тегам.</p>
        </header>
        <section class="catalog-search ui-enter" aria-label="Поиск по каталогу">
          <div class="catalog-search__field">
            <svg class="catalog-search__icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15.5 14h-.79l-.28-.27a6 6 0 1 0-.71.71l.27.28v.79l4.25 4.25a1 1 0 0 0 1.42-1.42L15.5 14zm-5 0a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <input id="catalogSearchInput" class="catalog-search__input" type="search" name="search" placeholder="Поиск материалов" aria-label="Поиск по каталогу" />
          </div>
        </section>
        <div class="catalog-categories-wrap ui-enter">
          <section id="categories" class="catalog-categories"></section>
        </div>
        <section id="catalog-list" class="catalog-list ui-stagger"></section>
      </section>
    `;

    renderCategoriesSkeleton(5);
    renderCatalogSkeleton(4);

    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) {
      searchInput.value = catalogUiState.query || '';
      searchInput.addEventListener('input', () => {
        catalogUiState.query = searchInput.value || '';
        applyCatalogFilters();
      });
    }

    loadAppData()
      .then((data) => {
        if (!isCurrentRender(renderToken)) {
          return;
        }
        catalogUiState.categoryId = Number(catalogUiState.categoryId) || 0;
        renderCategories(data.categories);
        applyCatalogFilters();
        root.setAttribute('aria-busy', 'false');
      })
      .catch(() => {
        if (!isCurrentRender(renderToken)) {
          return;
        }
        renderInlineError('categories', 'Не удалось загрузить категории.');
        renderInlineError('catalog-list', 'Не удалось загрузить материалы.');
        root.setAttribute('aria-busy', 'false');
      });
  }

  function renderDownloadButtonState(button) {
    if (!button) {
      return;
    }

    const authed = isAuthenticated();
    button.textContent = authed ? 'Скачать' : 'Войти и скачать';
    button.setAttribute('aria-label', authed ? 'Скачать материал' : 'Войти и скачать материал');
    button.classList.toggle('button--primary', authed);
    button.classList.toggle('button--secondary', !authed);
    button.classList.remove('is-loading');
    button.disabled = false;
  }

  function renderMaterialError(message, downloadButton) {
    const coverEl = document.getElementById('materialCover');
    const kickerEl = document.getElementById('materialKicker');
    const titleEl = document.getElementById('materialTitle');
    const descriptionEl = document.getElementById('materialDescription');

    if (coverEl) {
      coverEl.classList.remove('skeleton');
    }

    if (kickerEl) {
      kickerEl.textContent = 'Ошибка';
    }

    if (titleEl) {
      titleEl.textContent = message;
    }

    if (descriptionEl) {
      descriptionEl.textContent = 'Попробуйте обновить страницу позже.';
    }

    if (downloadButton) {
      downloadButton.textContent = 'Недоступно';
      downloadButton.disabled = true;
      downloadButton.classList.remove('button--primary', 'button--secondary');
      downloadButton.classList.remove('is-loading');
    }
  }

  async function renderMaterialView(route, renderToken) {
    const root = getSpaRoot();
    if (!root) {
      return;
    }
    root.setAttribute('aria-busy', 'true');

    const materialId = Number(route.params.id);
    if (!Number.isFinite(materialId) || materialId <= 0) {
      navigateTo(HOME_HASH, { replace: true });
      return;
    }

    root.innerHTML = `
      <button id="materialBackButton" class="material-page__back-button" aria-label="Назад" type="button">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="material-page__back-label">Назад</span>
      </button>

      <div class="material-page__hero ui-enter">
        <div id="materialCover" class="material-page__cover skeleton"></div>
        <div class="material-page__headline">
          <p id="materialKicker" class="material-page__kicker">Материал</p>
          <h1 id="materialTitle" class="material-page__title"><span class="skeleton skeleton-line skeleton-line--title"></span></h1>
        </div>
      </div>

      <div class="material-download ui-enter">
        <button id="downloadBtn" class="button button--secondary button--download is-loading" type="button">Скачать</button>
      </div>

      <div class="material-page__content">
        <section class="material-page__section section ui-enter">
          <h2 class="material-page__section-title section-title">О материале</h2>
          <p id="materialDescription" class="material-page__description text-body">
            <span class="skeleton skeleton-line"></span>
            <span class="skeleton skeleton-line" style="margin-top:8px;width:94%;"></span>
            <span class="skeleton skeleton-line" style="margin-top:8px;width:80%;"></span>
          </p>
        </section>

        <section class="material-page__section section ui-enter">
          <h2 class="material-page__section-title section-title">Теги</h2>
          <div id="materialTags" class="material-page__tags">
            <span class="skeleton skeleton-chip"></span>
            <span class="skeleton skeleton-chip"></span>
            <span class="skeleton skeleton-chip"></span>
          </div>
        </section>
      </div>
    `;

    const backButton = document.getElementById('materialBackButton');
    if (backButton) {
      backButton.addEventListener('click', (event) => {
        event.preventDefault();
        if (canGoBackInApp()) {
          window.history.back();
          return;
        }
        navigateTo('#/catalog');
      });
    }

    const downloadButton = document.getElementById('downloadBtn');
    renderDownloadButtonState(downloadButton);

    void refreshAuthSession().then(() => {
      if (!isCurrentRender(renderToken)) {
        return;
      }
      renderDownloadButtonState(downloadButton);
    });

    try {
      const data = await loadAppData();
      if (!isCurrentRender(renderToken)) {
        return;
      }

      if (!data || !Array.isArray(data.materials)) {
        throw new Error('Invalid data.json format');
      }

      const material = data.materials.find((item) => item.id === materialId);
      if (!material) {
        navigateTo(HOME_HASH, { replace: true });
        return;
      }

      const coverEl = document.getElementById('materialCover');
      const kickerEl = document.getElementById('materialKicker');
      const titleEl = document.getElementById('materialTitle');
      const descriptionEl = document.getElementById('materialDescription');
      const tagsContainer = document.getElementById('materialTags');

      if (coverEl) {
        coverEl.style.backgroundImage = `url(${material.cover})`;
        coverEl.classList.remove('skeleton');
      }

      if (kickerEl) {
        kickerEl.textContent = getCategoryNameById(material.categoryId);
      }

      if (titleEl) {
        titleEl.textContent = material.title;
      }

      if (descriptionEl) {
        descriptionEl.textContent = material.description;
      }

      if (tagsContainer) {
        tagsContainer.innerHTML = '';
        if (Array.isArray(material.tags) && material.tags.length > 0) {
          material.tags.forEach((tag) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'material-page__tag chip chip--tag';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
          });
        } else {
          tagsContainer.innerHTML = '<span class="material-page__tag chip chip--tag">Без тегов</span>';
        }
      }

      if (downloadButton) {
        downloadButton.onclick = () => {
          if (!isAuthenticated()) {
            navigateTo(buildAuthHash(`#/material/${material.id}`));
            return;
          }

          if (material.pdfUrl) {
            window.open(material.pdfUrl, '_blank', 'noopener,noreferrer');
          } else {
            alert('Ссылка на материал недоступна');
          }
        };
      }
      root.setAttribute('aria-busy', 'false');
    } catch (_error) {
      if (!isCurrentRender(renderToken)) {
        return;
      }
      root.setAttribute('aria-busy', 'false');
      renderMaterialError('Не удалось загрузить материал.', downloadButton);
    }
  }

  async function renderAuthView(route, renderToken) {
    const root = getSpaRoot();
    if (!root) {
      return;
    }

    const redirectHash = sanitizeRedirectHash(route.query.redirect) || HOME_HASH;

    if (isAuthenticated()) {
      navigateTo(redirectHash, { replace: true });
      return;
    }

    root.innerHTML = `
      <div class="auth-page ui-enter">
        <section class="auth-panel" aria-labelledby="authTitle">
          <header class="auth-panel__header">
            <p class="screen-header__kicker">Доступ</p>
            <h1 id="authTitle" class="page-title auth-form__title">Вход или регистрация</h1>
            <p class="screen-header__subtitle auth-form__subtitle text-body">Используйте email и пароль, чтобы войти или создать аккаунт.</p>
          </header>

          <form class="auth-form" id="authLoginForm" novalidate>
            <input
              type="email"
              id="authEmail"
              class="auth-form__input"
              placeholder="name@example.com"
              required
              autocomplete="email"
              inputmode="email"
              aria-label="Email"
            />
            <input
              type="password"
              id="authPassword"
              class="auth-form__input"
              placeholder="Пароль (мин. 6 символов)"
              required
              autocomplete="current-password"
              aria-label="Пароль"
            />
            <p id="authError" class="auth-form__error" role="alert" aria-live="polite"></p>
            <div class="auth-form__actions">
              <button type="submit" class="button button--primary" data-action="login">Войти</button>
              <button type="submit" class="button button--secondary" data-action="signup">Зарегистрироваться</button>
            </div>
          </form>

          <p class="auth-form__note">
            Пароль должен содержать не менее 6 символов.
            Мы отправим письмо для подтверждения на ваш email.
          </p>
        </section>
      </div>
    `;

    void refreshAuthSession().then(() => {
      if (!isCurrentRender(renderToken)) {
        return;
      }
      if (isAuthenticated()) {
        navigateTo(redirectHash, { replace: true });
      }
    });

    const form = document.getElementById('authLoginForm');
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const errorEl = document.getElementById('authError');
    const client = getSupabaseClient();

    if (!form || !emailInput || !passwordInput || !errorEl) {
      return;
    }

    let submitAction = 'login';

    function setError(message) {
      if (message) {
        errorEl.textContent = message;
        errorEl.classList.add('auth-form__error--visible');
      } else {
        errorEl.textContent = '';
        errorEl.classList.remove('auth-form__error--visible');
      }
    }

    function setLoading(isLoading) {
      const buttons = form.querySelectorAll('button[data-action]');
      buttons.forEach((button) => {
        button.disabled = isLoading;
      });
      emailInput.disabled = isLoading;
      passwordInput.disabled = isLoading;
    }

    async function handleAuth(action) {
      setError('');

      if (!client || typeof client.auth.signInWithPassword !== 'function') {
        setError('Не удалось подключиться к сервису авторизации. Попробуйте позже.');
        return;
      }

      const email = (emailInput.value || '').trim();
      const password = passwordInput.value || '';
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email || !emailPattern.test(email)) {
        setError('Введите корректный email.');
        return;
      }

      if (!password || password.length < 6) {
        setError('Минимум 6 символов в пароле.');
        return;
      }

      setLoading(true);

      try {
        if (action === 'signup') {
          const { error } = await client.auth.signUp({ email, password });
          if (error) {
            const code = error.code || '';
            const message = (error.message || '').toLowerCase();
            if (code === 'user_already_exists' || message.includes('user already registered') || message.includes('user already exists')) {
              setError('Этот email уже зарегистрирован. Попробуйте войти или восстановить пароль.');
            } else {
              setError('Не удалось зарегистрироваться. Попробуйте ещё раз или чуть позже.');
            }
            return;
          }

          setError('Мы отправили письмо для подтверждения. После подтверждения вернитесь и войдите с паролем.');
          return;
        }

        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          setError('Не удалось войти. Проверьте email и пароль и попробуйте ещё раз.');
          return;
        }

        navigateTo(redirectHash, { replace: true });
      } catch (error) {
        console.warn('Ошибка авторизации', error);
        setError('Что-то пошло не так. Попробуйте ещё раз.');
      } finally {
        setLoading(false);
      }
    }

    form.addEventListener('click', (event) => {
      const actionButton = event.target.closest('button[data-action]');
      if (actionButton && actionButton.dataset.action) {
        submitAction = actionButton.dataset.action;
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      handleAuth(submitAction);
    });
  }

  async function renderAccountView(renderToken) {
    const root = getSpaRoot();
    if (!root) {
      return;
    }

    await refreshAuthSession();

    if (!isCurrentRender(renderToken)) {
      return;
    }

    if (!isAuthenticated()) {
      navigateTo(buildAuthHash('#/account'), { replace: true });
      return;
    }

    root.innerHTML = `
      <header class="account-header screen-header ui-enter">
        <p class="account-kicker">Аккаунт</p>
        <h1 class="page-title">Личный кабинет</h1>
        <p class="account-subtitle text-body">Проверьте email и управляйте доступом к материалам.</p>
      </header>

      <section class="card account-card ui-enter" aria-labelledby="accountEmail">
        <div class="account-identity">
          <div>
            <p class="account-label">Ваш email</p>
            <p id="accountEmail" class="account-email">Загрузка...</p>
          </div>
        </div>

        <div class="account-actions">
          <button id="changePasswordButton" class="button button--secondary" type="button">Изменить пароль</button>
          <button id="logoutButton" class="button button--primary" type="button">Выйти</button>
          <p id="accountError" class="account-error" role="alert" aria-live="polite"></p>
          <p class="account-version">Версия приложения v1</p>
        </div>
      </section>
    `;

    const emailEl = document.getElementById('accountEmail');
    const errorEl = document.getElementById('accountError');
    const logoutButton = document.getElementById('logoutButton');
    const changePasswordButton = document.getElementById('changePasswordButton');
    const client = getSupabaseClient();

    function setError(message) {
      if (!errorEl) {
        return;
      }

      if (message) {
        errorEl.textContent = message;
        errorEl.classList.add('account-error--visible');
      } else {
        errorEl.textContent = '';
        errorEl.classList.remove('account-error--visible');
      }
    }

    if (emailEl) {
      emailEl.textContent = authSession?.user?.email || 'Без email';
    }

    if (changePasswordButton) {
      changePasswordButton.addEventListener('click', () => {
        alert('Функция в разработке');
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        setError('');

        if (!client || typeof client.auth.signOut !== 'function') {
          navigateTo(buildAuthHash(HOME_HASH), { replace: true });
          return;
        }

        const defaultText = 'Выйти';
        logoutButton.disabled = true;
        logoutButton.textContent = 'Выходим...';

        try {
          const { error } = await client.auth.signOut();
          if (error) {
            throw error;
          }
          navigateTo(buildAuthHash(HOME_HASH), { replace: true });
        } catch (error) {
          console.warn('Ошибка при выходе из Supabase', error);
          logoutButton.disabled = false;
          logoutButton.textContent = defaultText;
          setError('Не удалось выйти. Попробуйте ещё раз.');
        }
      });
    }
  }

  async function applyRoute(route, options = {}) {
    const { skipHistory = false } = options;

    currentRoute = route;
    if (!skipHistory) {
      pushRouteHistory(route.fullHash);
    }

    const renderToken = ++currentRenderToken;

    applyShellState(route.name);
    updateBottomNavActive(route.name);

    if (route.name === 'home') {
      renderHomeView(renderToken);
      return;
    }

    if (route.name === 'catalog') {
      renderCatalogView(renderToken);
      return;
    }

    if (route.name === 'material') {
      await renderMaterialView(route, renderToken);
      return;
    }

    if (route.name === 'auth') {
      await renderAuthView(route, renderToken);
      return;
    }

    if (route.name === 'account') {
      await renderAccountView(renderToken);
      return;
    }

    navigateTo(HOME_HASH, { replace: true });
  }

  async function processCurrentHash(options = {}) {
    const route = parseHash(window.location.hash || HOME_HASH);
    if (route.name === 'unknown') {
      navigateTo(HOME_HASH, { replace: true });
      return;
    }

    await applyRoute(route, options);
  }

  function bindStaticNav() {
    const navHome = document.getElementById('nav-home');
    const navCatalog = document.getElementById('nav-catalog');

    if (navHome) {
      navHome.addEventListener('click', (event) => {
        event.preventDefault();
        navigateTo(HOME_HASH);
      });
    }

    if (navCatalog) {
      navCatalog.addEventListener('click', (event) => {
        event.preventDefault();
        navigateTo('#/catalog');
      });
    }
  }

  function syncMaterialDownloadCta() {
    if (!currentRoute || currentRoute.name !== 'material') {
      return;
    }

    const downloadButton = document.getElementById('downloadBtn');
    if (downloadButton) {
      renderDownloadButtonState(downloadButton);
    }
  }

  function registerAuthListener() {
    const client = getSupabaseClient();
    if (!client || typeof client.auth.onAuthStateChange !== 'function') {
      return;
    }

    client.auth.onAuthStateChange((_event, session) => {
      authSession = session || null;

      if (typeof window.refreshNavAuthState === 'function') {
        window.refreshNavAuthState();
      }

      syncMaterialDownloadCta();

      if (!currentRoute) {
        return;
      }

      if (currentRoute.name === 'auth' && isAuthenticated()) {
        const redirectHash = sanitizeRedirectHash(currentRoute.query.redirect) || HOME_HASH;
        navigateTo(redirectHash, { replace: true });
        return;
      }

      if (currentRoute.name === 'account' && !isAuthenticated()) {
        navigateTo(buildAuthHash('#/account'), { replace: true });
      }
    });
  }

  function registerOrientationGuard() {
    if (typeof window === 'undefined' || !document.body) {
      return;
    }

    const hasMatchMedia = typeof window.matchMedia === 'function';
    const landscapeMedia = hasMatchMedia ? window.matchMedia('(orientation: landscape)') : null;
    const coarsePointerMedia = hasMatchMedia ? window.matchMedia('(pointer: coarse)') : null;
    const standaloneMedia = hasMatchMedia ? window.matchMedia('(display-mode: standalone)') : null;
    const isLegacyStandalone = window.navigator.standalone === true;

    let lockAttempted = false;
    let blocker = document.querySelector('.orientation-blocker');

    if (!blocker) {
      blocker = document.createElement('div');
      blocker.className = 'orientation-blocker';
      blocker.hidden = true;
      blocker.setAttribute('aria-live', 'polite');
      blocker.innerHTML = '<p class="orientation-blocker__text">Поверните устройство в портрет</p>';
      document.body.appendChild(blocker);
    }

    function bindMediaChange(mediaQueryList, handler) {
      if (!mediaQueryList) {
        return;
      }

      if (typeof mediaQueryList.addEventListener === 'function') {
        mediaQueryList.addEventListener('change', handler);
        return;
      }

      if (typeof mediaQueryList.addListener === 'function') {
        mediaQueryList.addListener(handler);
      }
    }

    async function tryLockPortrait() {
      if (lockAttempted) {
        return;
      }

      const orientation = window.screen && window.screen.orientation;
      if (!orientation || typeof orientation.lock !== 'function') {
        return;
      }

      const isStandalone = Boolean((standaloneMedia && standaloneMedia.matches) || isLegacyStandalone);
      if (!isStandalone) {
        return;
      }

      lockAttempted = true;
      try {
        await orientation.lock('portrait');
      } catch (_error) {
        // Orientation lock is best-effort and often unavailable by platform policy.
      }
    }

    function isMobileOrTouchScope() {
      const hasCoarsePointer = coarsePointerMedia ? coarsePointerMedia.matches : (window.navigator.maxTouchPoints || 0) > 0;
      return hasCoarsePointer || window.innerWidth <= 900;
    }

    function isLandscape() {
      if (landscapeMedia) {
        return landscapeMedia.matches;
      }
      return window.innerWidth > window.innerHeight;
    }

    function syncOrientationGuard() {
      const shouldBlock = isMobileOrTouchScope() && isLandscape();
      document.body.classList.toggle('is-landscape-blocked', shouldBlock);
      if (blocker) {
        blocker.hidden = !shouldBlock;
      }
      void tryLockPortrait();
    }

    bindMediaChange(landscapeMedia, syncOrientationGuard);
    bindMediaChange(coarsePointerMedia, syncOrientationGuard);
    bindMediaChange(standaloneMedia, syncOrientationGuard);
    window.addEventListener('resize', syncOrientationGuard);
    window.addEventListener('orientationchange', syncOrientationGuard);

    syncOrientationGuard();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((error) => {
        console.warn('Не удалось зарегистрировать Service Worker', error);
      });
    });
  }

  function init() {
    bindStaticNav();
    registerAuthListener();
    registerOrientationGuard();
    registerServiceWorker();

    window.addEventListener('hashchange', () => {
      void processCurrentHash();
    });

    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = HOME_HASH;
    }

    void processCurrentHash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

