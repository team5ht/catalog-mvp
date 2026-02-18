import { getSpaRoot } from '../dom.js';
import {
  getLoadedAppData,
  loadAppData,
  getCategoryNameById
} from '../services/data-service.js';
import { getCatalogUiState, isCurrentRender } from '../state.js';
import { createResponsivePicture } from '../ui/responsive-image.js';
import {
  renderCatalogSkeleton,
  renderCategoriesSkeleton,
  renderInlineError
} from '../ui/placeholders.js';

const catalogUiState = getCatalogUiState();
let loadedCatalogData = null;
let catalogViewNode = null;
let catalogHydrated = false;
let catalogLoadPromise = null;

function createCatalogViewNode() {
  const viewNode = document.createElement('section');
  viewNode.className = 'catalog-view';
  viewNode.innerHTML = `
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

  return viewNode;
}

function getFilteredCatalogMaterials(data) {
  if (!data || !Array.isArray(data.materials)) {
    return [];
  }

  const normalizedQuery = (catalogUiState.query || '').trim().toLowerCase();
  const selectedCategoryId = Number(catalogUiState.categoryId) || 0;

  return data.materials.filter((material) => {
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
    coverLink.href = `#/material/${material.id}`;
    coverLink.setAttribute('aria-label', material.title);
    coverLink.appendChild(
      createResponsivePicture({
        asset: material.cover.asset,
        alt: material.cover.alt,
        focalPoint: material.cover.focalPoint,
        preset: 'coverCatalog'
      })
    );

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

function applyCatalogFilters(data) {
  if (!data || !Array.isArray(data.materials)) {
    return;
  }

  renderCatalog(getFilteredCatalogMaterials(data));
  syncActiveCategoryChip();
}

function renderCategories(categories, data) {
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
      applyCatalogFilters(data);
    });

    container.appendChild(button);
  });

  syncActiveCategoryChip();
}

export function renderCatalogView(renderToken) {
  const root = getSpaRoot();
  if (!root) {
    return;
  }
  root.setAttribute('aria-busy', 'true');

  const firstMount = catalogViewNode === null;
  if (firstMount) {
    catalogViewNode = createCatalogViewNode();
  }

  if (root.firstElementChild !== catalogViewNode || root.childElementCount !== 1) {
    root.replaceChildren(catalogViewNode);
  }

  const searchInput = document.getElementById('catalogSearchInput');
  if (searchInput) {
    searchInput.value = catalogUiState.query || '';
    if (firstMount) {
      searchInput.addEventListener('input', () => {
        catalogUiState.query = searchInput.value || '';
        applyCatalogFilters(loadedCatalogData);
      });
    }
  }

  if (catalogHydrated) {
    root.setAttribute('aria-busy', 'false');
    return;
  }

  const availableData = loadedCatalogData || getLoadedAppData();
  if (
    availableData
    && Array.isArray(availableData.categories)
    && Array.isArray(availableData.materials)
  ) {
    loadedCatalogData = availableData;
    catalogUiState.categoryId = Number(catalogUiState.categoryId) || 0;
    renderCategories(availableData.categories, availableData);
    applyCatalogFilters(availableData);
    catalogHydrated = true;
    root.setAttribute('aria-busy', 'false');
    return;
  }

  if (firstMount) {
    renderCategoriesSkeleton(5);
    renderCatalogSkeleton(4);
  }

  if (catalogLoadPromise) {
    return;
  }

  catalogLoadPromise = loadAppData()
    .then((data) => {
      loadedCatalogData = data;
      if (!isCurrentRender(renderToken)) {
        return;
      }
      catalogUiState.categoryId = Number(catalogUiState.categoryId) || 0;
      renderCategories(data.categories, data);
      applyCatalogFilters(data);
      catalogHydrated = true;
      root.setAttribute('aria-busy', 'false');
    })
    .catch(() => {
      if (!isCurrentRender(renderToken)) {
        return;
      }
      renderInlineError('categories', 'Не удалось загрузить категории.');
      renderInlineError('catalog-list', 'Не удалось загрузить материалы.');
      root.setAttribute('aria-busy', 'false');
    })
    .finally(() => {
      catalogLoadPromise = null;
    });
}
