let appData = null;
const DATA_URL = 'data.json';

// Единая загрузка данных каталога с кешированием в appData.
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
  if (!container) return;
  container.innerHTML = '';
  const errorEl = document.createElement('p');
  errorEl.className = 'load-error';
  errorEl.textContent = message;
  container.appendChild(errorEl);
}

function renderMaterialsCarousel(containerId, materials, limit = 5) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  (materials || []).slice(0, limit).forEach((m) => {
    const card = document.createElement('div');
    card.className = 'material-card material-card--narrow';
    card.title = m.title;
    card.onclick = () => (location.href = `material.html?id=${m.id}`);

    const cover = document.createElement('div');
    cover.className = 'material-card__cover';
    cover.style.backgroundImage = `url(${m.cover})`;

    const title = document.createElement('p');
    title.className = 'material-card__title';
    title.textContent = m.title;

    card.appendChild(cover);
    card.appendChild(title);
    container.appendChild(card);
  });
}

function renderCategories(categories) {
  const container = document.getElementById('categories');
  if (!container) return;
  container.innerHTML = '';
  (categories || []).forEach((cat) => {
    const button = document.createElement('button');
    button.className = 'catalog-categories__button';
    button.dataset.id = cat.id;

    const chip = document.createElement('span');
    chip.className = 'chip chip--interactive';
    chip.textContent = cat.name;
    button.appendChild(chip);

    button.onclick = () => {
      document
        .querySelectorAll('.catalog-categories__button .chip')
        .forEach((chipEl) => chipEl.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      filterCatalog(cat.id);
    };

    container.appendChild(button);
  });

  const firstChip = container.querySelector('.catalog-categories__button .chip');
  if (firstChip) {
    firstChip.classList.add('chip--active');
  }
}

function renderCatalog(materials) {
  const container = document.getElementById('catalog-list');
  if (!container) return;
  container.innerHTML = '';
  (materials || []).forEach((m) => {
    const card = document.createElement('article');
    card.className = 'catalog-card';

    const coverLink = document.createElement('a');
    coverLink.className = 'catalog-card__cover';
    coverLink.style.backgroundImage = `url(${m.cover})`;
    coverLink.href = `material.html?id=${m.id}`;
    coverLink.setAttribute('aria-label', m.title);

    const info = document.createElement('div');
    info.className = 'catalog-card__info';

    const title = document.createElement('h3');
    title.className = 'catalog-card__title';

    const titleLink = document.createElement('a');
    titleLink.className = 'catalog-card__title-link';
    titleLink.href = `material.html?id=${m.id}`;
    titleLink.textContent = m.title;

    title.appendChild(titleLink);
    info.appendChild(title);

    card.appendChild(coverLink);
    card.appendChild(info);

    container.appendChild(card);
  });
}

function filterCatalog(categoryId) {
  if (!appData || !appData.materials) {
    return;
  }
  const filtered = categoryId ? appData.materials.filter((m) => m.categoryId === categoryId) : appData.materials;
  renderCatalog(filtered);
}
