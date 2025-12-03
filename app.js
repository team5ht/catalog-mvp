const AUTH_STORAGE_KEY = 'auth_logged_in';
let appData = null;

function getAuthModule() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.AuthState || null;
}

function isUserAuthenticated() {
  const authModule = getAuthModule();
  if (authModule && typeof authModule.isAuthenticated === 'function') {
    return authModule.isAuthenticated();
  }
  return false;
}

function checkAuth() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

function logout() {
  try {
    const supabaseClient = typeof window !== 'undefined' ? window.supabaseClient : null;
    if (supabaseClient && supabaseClient.auth && typeof supabaseClient.auth.signOut === 'function') {
      supabaseClient.auth.signOut().catch((error) => {
        console.warn('Ошибка при выходе из Supabase', error);
      });
    }
  } catch (err) {
    console.warn('Не удалось выполнить выход из Supabase', err);
  }

  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (err) {
    console.warn('Не удалось удалить состояние авторизации', err);
  }

  alert('Вы вышли из аккаунта.');
  window.location.href = 'index.html';
}

function setupLogoutAction() {
  if (typeof document === 'undefined') {
    return;
  }
  const logoutBtn = document.querySelector('[data-auth-logout]');
  if (!logoutBtn) {
    return;
  }

  const isAuthed = isUserAuthenticated();
  logoutBtn.hidden = !isAuthed;
  logoutBtn.classList.toggle('bottom-nav__text-button--visible', isAuthed);

  if (!isAuthed || logoutBtn.dataset.logoutBound === 'true') {
    return;
  }

  logoutBtn.addEventListener('click', (event) => {
    event.preventDefault();
    logout();
  });
  logoutBtn.dataset.logoutBound = 'true';
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', setupLogoutAction);
}

if (typeof window !== 'undefined') {
  window.isUserAuthenticated = isUserAuthenticated;
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
