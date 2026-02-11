(function() {
  const DATA_URL = 'data.json';
  const HOME_HASH = '#/';
  const AUTH_MODE_LOGIN = 'login';
  const AUTH_MODE_FORGOT = 'forgot';
  const AUTH_MODE_RECOVERY = 'recovery';
  const PASSWORD_MIN_LENGTH = 6;
  const RECOVERY_RESEND_COOLDOWN_SECONDS = 50;
  const FORGOT_COOLDOWN_STORAGE_KEY = 'catalog.auth.forgotCooldownUntil';
  const RECOVERY_SEARCH_PARAM = 'auth_mode';
  const RECOVERY_SEARCH_VALUE = 'recovery';

  let appData = null;
  let currentRoute = null;
  let currentRenderToken = 0;
  let recoveryFlowActive = false;
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

  function getAuthStore() {
    return window.authStore || null;
  }

  function initializeAuthStore() {
    const store = getAuthStore();
    if (store && typeof store.init === 'function') {
      store.init();
    }
    return store;
  }

  function getSupabaseClient() {
    const client = window.supabaseClient;
    if (!client || !client.auth) {
      return null;
    }
    return client;
  }

  function isAuthenticated() {
    const store = getAuthStore();
    if (!store || typeof store.isAuthenticated !== 'function') {
      return false;
    }
    return store.isAuthenticated();
  }

  async function refreshAuthSession(options = {}) {
    const { force = false } = options;
    const store = initializeAuthStore();
    if (!store) {
      return null;
    }

    try {
      if (force && typeof store.refresh === 'function') {
        return await store.refresh();
      }

      if (typeof store.whenReady === 'function') {
        return await store.whenReady();
      }
    } catch (error) {
      console.warn('Не удалось синхронизировать auth-store', error);
    }

    return null;
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

  function normalizeAuthMode(inputMode) {
    if (typeof inputMode !== 'string') {
      return AUTH_MODE_LOGIN;
    }

    const mode = inputMode.trim().toLowerCase();
    if (mode === AUTH_MODE_FORGOT || mode === AUTH_MODE_RECOVERY) {
      return mode;
    }

    return AUTH_MODE_LOGIN;
  }

  function getAuthModeFromRoute(route) {
    if (!route || !route.query) {
      return AUTH_MODE_LOGIN;
    }

    return normalizeAuthMode(route.query.mode);
  }

  function isValidEmail(value) {
    if (typeof value !== 'string') {
      return false;
    }

    const email = value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  function validatePasswordPair(password, confirmPassword) {
    const normalizedPassword = typeof password === 'string' ? password : '';
    const normalizedConfirmPassword = typeof confirmPassword === 'string' ? confirmPassword : '';

    if (normalizedPassword.length < PASSWORD_MIN_LENGTH) {
      return `Минимум ${PASSWORD_MIN_LENGTH} символов в пароле.`;
    }

    if (normalizedPassword !== normalizedConfirmPassword) {
      return 'Пароли не совпадают.';
    }

    return '';
  }

  function isAuthRateLimitError(error) {
    const status = Number(error && error.status);
    const code = String((error && error.code) || '').toLowerCase();
    const message = String((error && error.message) || '').toLowerCase();

    return (
      status === 429 ||
      code === 'over_email_send_rate_limit' ||
      message.includes('only request this after') ||
      message.includes('too many requests') ||
      message.includes('rate limit')
    );
  }

  function getRetryAfterSeconds(error, fallbackSeconds = RECOVERY_RESEND_COOLDOWN_SECONDS) {
    const message = String((error && error.message) || '');
    const match = message.match(/after\s+(\d+)\s+seconds?/i);
    const parsed = match ? Number(match[1]) : NaN;

    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }

    return fallbackSeconds;
  }

  async function updateUserPassword(client, password) {
    if (!client || !client.auth || typeof client.auth.updateUser !== 'function') {
      return {
        ok: false,
        error: new Error('SUPABASE_CLIENT_UNAVAILABLE')
      };
    }

    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        return { ok: false, error };
      }

      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function buildRecoveryRedirectUrl() {
    const params = new URLSearchParams();
    params.set(RECOVERY_SEARCH_PARAM, RECOVERY_SEARCH_VALUE);

    const query = params.toString();
    const pathname = window.location.pathname || '/';
    return `${window.location.origin}${pathname}${query ? `?${query}` : ''}`;
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

  function buildAuthHash(redirectHash, options = {}) {
    const { mode = AUTH_MODE_LOGIN } = options;
    const normalizedMode = normalizeAuthMode(mode);
    const params = new URLSearchParams();
    const safeRedirect = sanitizeRedirectHash(redirectHash);

    if (safeRedirect) {
      params.set('redirect', safeRedirect);
    }

    if (normalizedMode !== AUTH_MODE_LOGIN) {
      params.set('mode', normalizedMode);
    }

    const query = params.toString();
    return query ? `#/auth?${query}` : '#/auth';
  }

  function consumeRecoverySearchMarker() {
    const search = window.location.search || '';
    if (!search) {
      return false;
    }

    const params = new URLSearchParams(search);
    if (params.get(RECOVERY_SEARCH_PARAM) !== RECOVERY_SEARCH_VALUE) {
      return false;
    }

    recoveryFlowActive = true;
    params.delete(RECOVERY_SEARCH_PARAM);
    const nextSearch = params.toString();
    const pathname = window.location.pathname || '/';
    const currentHash = window.location.hash || '';
    const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ''}${currentHash}`;
    window.history.replaceState(null, '', nextUrl);
    return true;
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
    const authMode = getAuthModeFromRoute(route);
    const loginHash = buildAuthHash(redirectHash);
    const forgotHash = buildAuthHash(redirectHash, { mode: AUTH_MODE_FORGOT });

    if (authMode === AUTH_MODE_LOGIN && isAuthenticated()) {
      navigateTo(redirectHash, { replace: true });
      return;
    }

    let authTitle = 'Вход или регистрация';
    let authSubtitle = 'Используйте email и пароль, чтобы войти или создать аккаунт.';
    let authNote = `
      Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов.
      Мы отправим письмо для подтверждения на ваш email.
    `;
    let formMarkup = `
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
        placeholder="Пароль (мин. ${PASSWORD_MIN_LENGTH} символов)"
        required
        autocomplete="current-password"
        aria-label="Пароль"
      />
      <p id="authStatus" class="auth-form__status" role="alert" aria-live="polite"></p>
      <div class="auth-form__actions">
        <button type="submit" class="button button--primary" data-action="login">Войти</button>
        <button type="submit" class="button button--secondary" data-action="signup">Зарегистрироваться</button>
      </div>
      <div class="auth-form__meta">
        <a class="auth-form__link" href="${forgotHash}">Забыли пароль?</a>
      </div>
    `;

    if (authMode === AUTH_MODE_FORGOT) {
      authTitle = 'Восстановление пароля';
      authSubtitle = 'Введите email, и мы отправим ссылку для сброса пароля.';
      authNote = 'Если аккаунт с таким email существует, письмо придет в течение пары минут.';
      formMarkup = `
        <input
          type="email"
          id="authRecoveryEmail"
          class="auth-form__input"
          placeholder="name@example.com"
          required
          autocomplete="email"
          inputmode="email"
          aria-label="Email для восстановления"
        />
        <p id="authStatus" class="auth-form__status" role="alert" aria-live="polite"></p>
        <div class="auth-form__actions">
          <button type="submit" class="button button--primary" data-action="forgot">Отправить ссылку</button>
        </div>
        <div class="auth-form__meta">
          <a class="auth-form__link" href="${loginHash}">Назад ко входу</a>
        </div>
      `;
    }

    if (authMode === AUTH_MODE_RECOVERY) {
      authTitle = 'Новый пароль';
      authSubtitle = 'Введите новый пароль для аккаунта.';
      authNote = `Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов.`;
      formMarkup = `
        <input
          type="password"
          id="authNewPassword"
          class="auth-form__input"
          placeholder="Новый пароль"
          required
          autocomplete="new-password"
          aria-label="Новый пароль"
        />
        <input
          type="password"
          id="authConfirmPassword"
          class="auth-form__input"
          placeholder="Подтвердите пароль"
          required
          autocomplete="new-password"
          aria-label="Подтверждение пароля"
        />
        <p id="authStatus" class="auth-form__status" role="alert" aria-live="polite"></p>
        <div class="auth-form__actions">
          <button type="submit" class="button button--primary" data-action="recovery">Сохранить пароль</button>
        </div>
        <div class="auth-form__meta">
          <a class="auth-form__link" href="${forgotHash}">Отправить новую ссылку</a>
          <a class="auth-form__link" href="${loginHash}">Назад ко входу</a>
        </div>
      `;
    }

    root.innerHTML = `
      <div class="auth-page ui-enter">
        <section class="auth-panel" aria-labelledby="authTitle">
          <header class="auth-panel__header">
            <p class="screen-header__kicker">Доступ</p>
            <h1 id="authTitle" class="page-title auth-form__title">${authTitle}</h1>
            <p class="screen-header__subtitle auth-form__subtitle text-body">${authSubtitle}</p>
          </header>

          <form class="auth-form" id="authForm" novalidate>
            ${formMarkup}
          </form>

          <p class="auth-form__note">${authNote}</p>
        </section>
      </div>
    `;

    void refreshAuthSession().then(() => {
      if (!isCurrentRender(renderToken) || authMode !== AUTH_MODE_LOGIN) {
        return;
      }
      if (isAuthenticated()) {
        navigateTo(redirectHash, { replace: true });
      }
    });

    const form = document.getElementById('authForm');
    const statusEl = document.getElementById('authStatus');
    const client = getSupabaseClient();
    let forgotCooldownSeconds = 0;
    let forgotCooldownInterval = null;

    if (!form || !statusEl) {
      return;
    }

    function setStatus(message, tone = 'error') {
      statusEl.classList.remove(
        'auth-form__status--visible',
        'auth-form__status--error',
        'auth-form__status--success',
        'auth-form__status--info'
      );

      if (message) {
        statusEl.textContent = message;
        statusEl.classList.add('auth-form__status--visible', `auth-form__status--${tone}`);
      } else {
        statusEl.textContent = '';
      }
    }

    function getForgotCooldownRemainingSecondsFromStorage() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return 0;
      }

      try {
        const rawValue = window.localStorage.getItem(FORGOT_COOLDOWN_STORAGE_KEY);
        if (!rawValue) {
          return 0;
        }

        const cooldownUntil = Number(rawValue);
        if (!Number.isFinite(cooldownUntil) || cooldownUntil <= 0) {
          window.localStorage.removeItem(FORGOT_COOLDOWN_STORAGE_KEY);
          return 0;
        }

        const remainingSeconds = Math.ceil((cooldownUntil - Date.now()) / 1000);
        if (remainingSeconds <= 0) {
          window.localStorage.removeItem(FORGOT_COOLDOWN_STORAGE_KEY);
          return 0;
        }

        return remainingSeconds;
      } catch (_error) {
        return 0;
      }
    }

    function persistForgotCooldownSeconds(seconds) {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }

      const normalizedSeconds = Math.max(1, Math.floor(Number(seconds) || 0));
      if (!normalizedSeconds) {
        return;
      }

      const cooldownUntil = Date.now() + normalizedSeconds * 1000;
      try {
        window.localStorage.setItem(FORGOT_COOLDOWN_STORAGE_KEY, String(cooldownUntil));
      } catch (_error) {
        // ignore write errors (e.g., private mode restrictions)
      }
    }

    function clearForgotCooldownStorage() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }

      try {
        window.localStorage.removeItem(FORGOT_COOLDOWN_STORAGE_KEY);
      } catch (_error) {
        // ignore remove errors
      }
    }

    function setLoading(isLoading) {
      const controls = form.querySelectorAll('input, button');
      form.setAttribute('aria-busy', isLoading ? 'true' : 'false');
      const buttons = form.querySelectorAll('button[data-action]');
      buttons.forEach((button) => {
        if (button.dataset.defaultText == null) {
          button.dataset.defaultText = button.textContent;
        }
        button.textContent = isLoading ? 'Подождите...' : button.dataset.defaultText;
      });
      controls.forEach((control) => {
        control.disabled = isLoading;
      });

      if (!isLoading) {
        applyForgotCooldownUi();
      }
    }

    function getForgotButton() {
      return form.querySelector('button[data-action="forgot"]');
    }

    function applyForgotCooldownUi() {
      if (authMode !== AUTH_MODE_FORGOT) {
        return;
      }

      const forgotButton = getForgotButton();
      if (!forgotButton) {
        return;
      }

      if (forgotButton.dataset.defaultText == null) {
        forgotButton.dataset.defaultText = forgotButton.textContent || 'Отправить ссылку';
      }

      if (form.getAttribute('aria-busy') === 'true') {
        return;
      }

      if (forgotCooldownSeconds > 0) {
        forgotButton.disabled = true;
        forgotButton.textContent = `Повтор через ${forgotCooldownSeconds} c`;
      } else {
        forgotButton.disabled = false;
        forgotButton.textContent = forgotButton.dataset.defaultText;
      }
    }

    function stopForgotCooldown() {
      if (forgotCooldownInterval) {
        window.clearInterval(forgotCooldownInterval);
        forgotCooldownInterval = null;
      }

      forgotCooldownSeconds = 0;
      clearForgotCooldownStorage();
      applyForgotCooldownUi();
    }

    function startForgotCooldown(seconds) {
      const normalizedSeconds = Math.max(1, Math.floor(Number(seconds) || RECOVERY_RESEND_COOLDOWN_SECONDS));

      if (forgotCooldownInterval) {
        window.clearInterval(forgotCooldownInterval);
        forgotCooldownInterval = null;
      }

      forgotCooldownSeconds = normalizedSeconds;
      persistForgotCooldownSeconds(normalizedSeconds);
      applyForgotCooldownUi();

      forgotCooldownInterval = window.setInterval(() => {
        if (!isCurrentRender(renderToken)) {
          window.clearInterval(forgotCooldownInterval);
          forgotCooldownInterval = null;
          return;
        }

        forgotCooldownSeconds -= 1;
        if (forgotCooldownSeconds <= 0) {
          stopForgotCooldown();
          return;
        }

        applyForgotCooldownUi();
      }, 1000);
    }

    if (authMode === AUTH_MODE_LOGIN) {
      const emailInput = document.getElementById('authEmail');
      const passwordInput = document.getElementById('authPassword');
      if (!emailInput || !passwordInput) {
        return;
      }

      let submitAction = 'login';

      async function handleAuth(action) {
        setStatus('');

        if (!client || typeof client.auth.signInWithPassword !== 'function') {
          setStatus('Не удалось подключиться к сервису авторизации. Попробуйте позже.');
          return;
        }

        const email = (emailInput.value || '').trim();
        const password = passwordInput.value || '';

        if (!isValidEmail(email)) {
          setStatus('Введите корректный email.');
          return;
        }

        if (password.length < PASSWORD_MIN_LENGTH) {
          setStatus(`Минимум ${PASSWORD_MIN_LENGTH} символов в пароле.`);
          return;
        }

        setLoading(true);

        try {
          if (action === 'signup') {
            const { error } = await client.auth.signUp({ email, password });
            if (error) {
              const code = error.code || '';
              const message = (error.message || '').toLowerCase();
              if (
                code === 'user_already_exists' ||
                message.includes('user already registered') ||
                message.includes('user already exists')
              ) {
                setStatus('Этот email уже зарегистрирован. Попробуйте войти или восстановить пароль.');
              } else {
                setStatus('Не удалось зарегистрироваться. Попробуйте ещё раз или чуть позже.');
              }
              return;
            }

            setStatus(
              'Мы отправили письмо для подтверждения. После подтверждения вернитесь и войдите с паролем.',
              'success'
            );
            return;
          }

          const { error } = await client.auth.signInWithPassword({ email, password });
          if (error) {
            setStatus('Не удалось войти. Проверьте email и пароль и попробуйте ещё раз.');
            return;
          }

          navigateTo(redirectHash, { replace: true });
        } catch (error) {
          console.warn('Ошибка авторизации', error);
          setStatus('Что-то пошло не так. Попробуйте ещё раз.');
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
      return;
    }

    if (authMode === AUTH_MODE_FORGOT) {
      const emailInput = document.getElementById('authRecoveryEmail');
      if (!emailInput) {
        return;
      }

      const persistedCooldown = getForgotCooldownRemainingSecondsFromStorage();
      if (persistedCooldown > 0) {
        startForgotCooldown(persistedCooldown);
      } else {
        applyForgotCooldownUi();
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus('');

        if (!client || !client.auth || typeof client.auth.resetPasswordForEmail !== 'function') {
          setStatus('Не удалось подключиться к сервису авторизации. Попробуйте позже.');
          return;
        }

        const email = (emailInput.value || '').trim();
        if (!isValidEmail(email)) {
          setStatus('Введите корректный email.');
          return;
        }

        if (forgotCooldownSeconds > 0) {
          setStatus(`Повторная отправка будет доступна через ${forgotCooldownSeconds} сек.`, 'info');
          return;
        }

        setLoading(true);

        try {
          const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: buildRecoveryRedirectUrl()
          });

          if (error) {
            throw error;
          }

          setStatus(
            `Если аккаунт с этим email существует, мы отправили письмо с инструкцией по восстановлению пароля. Повторить отправку можно через ${RECOVERY_RESEND_COOLDOWN_SECONDS} сек.`,
            'success'
          );
          startForgotCooldown(RECOVERY_RESEND_COOLDOWN_SECONDS);
        } catch (error) {
          console.warn('Ошибка отправки recovery email', error);

          if (isAuthRateLimitError(error)) {
            const retryAfterSeconds = getRetryAfterSeconds(error, RECOVERY_RESEND_COOLDOWN_SECONDS);
            startForgotCooldown(retryAfterSeconds);
            setStatus(`Слишком частая отправка. Повторить можно через ${retryAfterSeconds} сек.`, 'info');
            return;
          }

          setStatus('Не удалось отправить письмо. Попробуйте ещё раз чуть позже.');
        } finally {
          setLoading(false);
        }
      });
      return;
    }

    const newPasswordInput = document.getElementById('authNewPassword');
    const confirmPasswordInput = document.getElementById('authConfirmPassword');
    if (!newPasswordInput || !confirmPasswordInput) {
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus('');

      const validationMessage = validatePasswordPair(newPasswordInput.value || '', confirmPasswordInput.value || '');
      if (validationMessage) {
        setStatus(validationMessage);
        return;
      }

      setLoading(true);

      try {
        let syncedState = await refreshAuthSession({ force: true });
        if (!(syncedState && syncedState.user)) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 240);
          });
          syncedState = await refreshAuthSession({ force: true });
        }

        if (!(syncedState && syncedState.user)) {
          setStatus('Ссылка восстановления недействительна или устарела. Запросите новую ссылку.');
          return;
        }

        const result = await updateUserPassword(client, newPasswordInput.value || '');
        if (!result.ok) {
          setStatus('Не удалось обновить пароль. Запросите новую ссылку и попробуйте ещё раз.');
          return;
        }

        setStatus('Пароль обновлен. Перенаправляем в личный кабинет...', 'success');
        window.setTimeout(() => {
          navigateTo('#/account', { replace: true });
        }, 550);
      } catch (error) {
        console.warn('Ошибка обновления пароля по recovery-ссылке', error);
        setStatus('Не удалось обновить пароль. Попробуйте ещё раз.');
      } finally {
        setLoading(false);
      }
    });
  }

  async function renderAccountView(renderToken) {
    const root = getSpaRoot();
    if (!root) {
      return;
    }

    const authState = await refreshAuthSession();

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
          <form id="accountPasswordForm" class="account-password-form" hidden novalidate>
            <input
              type="password"
              id="accountNewPassword"
              class="auth-form__input"
              placeholder="Новый пароль"
              required
              autocomplete="new-password"
              aria-label="Новый пароль"
            />
            <input
              type="password"
              id="accountConfirmPassword"
              class="auth-form__input"
              placeholder="Подтвердите новый пароль"
              required
              autocomplete="new-password"
              aria-label="Подтверждение нового пароля"
            />
            <div class="account-password-actions">
              <button id="accountSavePasswordButton" class="button button--primary" type="submit">Сохранить пароль</button>
              <button id="accountCancelPasswordButton" class="button button--secondary" type="button">Отмена</button>
            </div>
          </form>
          <button id="logoutButton" class="button button--primary" type="button">Выйти</button>
          <p id="accountStatus" class="account-status" role="alert" aria-live="polite"></p>
          <p class="account-version">Версия приложения v1</p>
        </div>
      </section>
    `;

    const emailEl = document.getElementById('accountEmail');
    const statusEl = document.getElementById('accountStatus');
    const logoutButton = document.getElementById('logoutButton');
    const changePasswordButton = document.getElementById('changePasswordButton');
    const passwordForm = document.getElementById('accountPasswordForm');
    const newPasswordInput = document.getElementById('accountNewPassword');
    const confirmPasswordInput = document.getElementById('accountConfirmPassword');
    const savePasswordButton = document.getElementById('accountSavePasswordButton');
    const cancelPasswordButton = document.getElementById('accountCancelPasswordButton');
    const client = getSupabaseClient();

    function setStatus(message, tone = 'error') {
      if (!statusEl) {
        return;
      }

      statusEl.classList.remove(
        'account-status--visible',
        'account-status--error',
        'account-status--success',
        'account-status--info'
      );

      if (message) {
        statusEl.textContent = message;
        statusEl.classList.add('account-status--visible', `account-status--${tone}`);
      } else {
        statusEl.textContent = '';
      }
    }

    function togglePasswordForm(nextOpenState) {
      if (!passwordForm || !changePasswordButton) {
        return;
      }

      const shouldOpen = typeof nextOpenState === 'boolean' ? nextOpenState : passwordForm.hidden;
      passwordForm.hidden = !shouldOpen;
      changePasswordButton.textContent = shouldOpen ? 'Скрыть форму' : 'Изменить пароль';

      if (!shouldOpen && typeof passwordForm.reset === 'function') {
        passwordForm.reset();
      }
    }

    if (emailEl) {
      emailEl.textContent = authState?.user?.email || 'Без email';
    }

    if (changePasswordButton) {
      changePasswordButton.addEventListener('click', () => {
        togglePasswordForm();
      });
    }

    if (cancelPasswordButton) {
      cancelPasswordButton.addEventListener('click', () => {
        togglePasswordForm(false);
        setStatus('');
      });
    }

    if (passwordForm && newPasswordInput && confirmPasswordInput && savePasswordButton && cancelPasswordButton) {
      passwordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus('');

        const validationMessage = validatePasswordPair(newPasswordInput.value || '', confirmPasswordInput.value || '');
        if (validationMessage) {
          setStatus(validationMessage);
          return;
        }

        if (!client || !client.auth || typeof client.auth.updateUser !== 'function') {
          setStatus('Не удалось подключиться к сервису авторизации. Попробуйте позже.');
          return;
        }

        const controls = passwordForm.querySelectorAll('input, button');
        controls.forEach((control) => {
          control.disabled = true;
        });
        const saveDefaultText = savePasswordButton.textContent || 'Сохранить пароль';
        savePasswordButton.textContent = 'Сохраняем...';

        try {
          const result = await updateUserPassword(client, newPasswordInput.value || '');
          if (!result.ok) {
            setStatus('Не удалось обновить пароль. Попробуйте ещё раз.');
            return;
          }

          togglePasswordForm(false);
          setStatus('Пароль успешно обновлен.', 'success');
        } catch (error) {
          console.warn('Ошибка обновления пароля в профиле', error);
          setStatus('Не удалось обновить пароль. Попробуйте ещё раз.');
        } finally {
          controls.forEach((control) => {
            control.disabled = false;
          });
          savePasswordButton.textContent = saveDefaultText;
        }
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        setStatus('');

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
          setStatus('Не удалось выйти. Попробуйте ещё раз.');
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
    if (consumeRecoverySearchMarker()) {
      const recoveryRoute = parseHash(buildAuthHash(null, { mode: AUTH_MODE_RECOVERY }));
      await applyRoute(recoveryRoute, options);
      return;
    }

    const rawHash = window.location.hash || '';
    if ((!rawHash || rawHash === '#') && recoveryFlowActive) {
      const recoveryRoute = parseHash(buildAuthHash(null, { mode: AUTH_MODE_RECOVERY }));
      await applyRoute(recoveryRoute, options);
      return;
    }

    const route = parseHash(window.location.hash || HOME_HASH);
    if (route.name === 'unknown') {
      if (recoveryFlowActive) {
        const recoveryRoute = parseHash(buildAuthHash(null, { mode: AUTH_MODE_RECOVERY }));
        await applyRoute(recoveryRoute, options);
        return;
      }
      navigateTo(HOME_HASH, { replace: true });
      return;
    }

    const isRecoveryRoute = route.name === 'auth' && getAuthModeFromRoute(route) === AUTH_MODE_RECOVERY;
    if (!isRecoveryRoute) {
      recoveryFlowActive = false;
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
    const store = initializeAuthStore();
    if (!store || typeof store.subscribe !== 'function') {
      return;
    }

    store.subscribe((state) => {
      const authed = Boolean(state && state.isAuthenticated);

      syncMaterialDownloadCta();

      if (!currentRoute) {
        return;
      }

      if (currentRoute.name === 'auth' && authed) {
        const authMode = getAuthModeFromRoute(currentRoute);
        if (authMode !== AUTH_MODE_LOGIN) {
          return;
        }
        const redirectHash = sanitizeRedirectHash(currentRoute.query.redirect) || HOME_HASH;
        navigateTo(redirectHash, { replace: true });
        return;
      }

      if (currentRoute.name === 'account' && !authed) {
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

