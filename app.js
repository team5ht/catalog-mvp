let appData = null;

function checkAuth() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

function logout() {
  if (confirm('Вы уверены, что хотите выйти?')) {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginDate');
    location.href = 'login.html';
  }
}

// Главная страница: рендер горизонтального скролла
function renderMainMaterials(materials) {
  const container = document.getElementById('main-materials');
  if (!container) return;
  container.innerHTML = '';
  materials.slice(0, 5).forEach(m => {
    const card = document.createElement('div');
    card.className = 'material-card material-card--narrow';
    card.title = m.title;
    card.onclick = () => location.href = `material.html?id=${m.id}`;

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

// Каталог: рендер категорий
function renderCategories(categories) {
  const container = document.getElementById('categories');
  if (!container) return;
  container.innerHTML = '';
  categories.forEach(cat => {
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
        .forEach(chipEl => chipEl.classList.remove('chip--active'));
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

// Каталог: рендер материалов списка
function renderCatalog(materials) {
  const container = document.getElementById('catalog-list');
  if (!container) return;
  container.innerHTML = '';
  materials.forEach(m => {
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
  if (!appData) return;
  if (!categoryId) {
    renderCatalog(appData.materials);
  } else {
    const filtered = appData.materials.filter(m => m.categoryId === categoryId);
    renderCatalog(filtered);
  }
}
