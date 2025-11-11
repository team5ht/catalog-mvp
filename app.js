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
    card.className = 'book-card narrow';
    card.style.backgroundImage = `url(${m.cover})`;
    card.title = m.title;
    card.textContent = m.title;
    container.appendChild(card);
  });
}

// Каталог: рендер категорий
function renderCategories(categories) {
  const container = document.getElementById('categories');
  if (!container) return;
  container.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.textContent = cat.name;
    btn.dataset.id = cat.id;
    btn.onclick = () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterCatalog(cat.id);
    };
    container.appendChild(btn);
  });
}

// Каталог: рендер материалов списка
function renderCatalog(materials) {
  const container = document.getElementById('catalog-list');
  if (!container) return;
  container.innerHTML = '';
  materials.forEach(m => {
    const card = document.createElement('div');
    card.className = 'book-card narrow';
    card.style.backgroundImage = `url(${m.cover})`;
    card.title = m.title;
    card.textContent = m.title;
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
