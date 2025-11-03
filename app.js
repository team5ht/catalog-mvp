// =================================
// ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ
// =================================

// Глобальная переменная для хранения загруженных данных
let appData = null;

// =================================
// ПРОВЕРКА АВТОРИЗАЦИИ
// =================================
function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const userEmail = localStorage.getItem('userEmail');

    if (!isLoggedIn) {
        // Если не авторизован — редирект на страницу входа
        window.location.href = 'login.html';
        return false;
    }

    // Показываем email пользователя в шапке
    const userInfo = document.getElementById('userInfo');
    const userEmailSpan = document.getElementById('userEmail');
    if (userInfo && userEmailSpan) {
        userInfo.style.display = 'flex';
        userEmailSpan.textContent = userEmail;
    }

    return true;
}

// =================================
// ВЫХОД ИЗ СИСТЕМЫ
// =================================
function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        // Очищаем данные авторизации
        localStorage.removeItem('userEmail');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('loginDate');
        
        // Перенаправляем на страницу входа
        window.location.href = 'login.html';
    }
}

// =================================
// ЗАГРУЗКА ДАННЫХ ИЗ JSON
// =================================
async function loadData() {
    try {
        const response = await fetch('data.json');
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки данных');
        }
        
        appData = await response.json();
        return appData;
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        document.getElementById('catalog').innerHTML = 
            '<p class="error">Ошибка загрузки каталога. Попробуйте обновить страницу.</p>';
        return null;
    }
}

// =================================
// РЕНДЕР КАТЕГОРИЙ
// =================================
function renderCategories(categories, activeSlug = null) {
    const nav = document.getElementById('categories');
    
    if (!nav) return;

    // Создаем HTML для категорий
    let html = `
        <a href="?" class="category ${!activeSlug ? 'active' : ''}">
            Все материалы
        </a>
    `;

    categories.forEach(category => {
        const isActive = category.slug === activeSlug ? 'active' : '';
        html += `
            <a href="?category=${category.slug}" class="category ${isActive}">
                ${category.name}
            </a>
        `;
    });

    nav.innerHTML = html;
}

// =================================
// РЕНДЕР КАРТОЧЕК МАТЕРИАЛОВ
// =================================
function renderMaterials(materials) {
    const catalog = document.getElementById('catalog');
    
    if (!catalog) return;

    // Если материалов нет
    if (materials.length === 0) {
        catalog.innerHTML = '<p class="no-results">Материалы не найдены</p>';
        return;
    }

    // Создаем HTML для карточек
    const html = materials.map(material => `
        <div class="card" onclick="openMaterial(${material.id})">
            <div class="card-image">
                <img src="${material.cover}" alt="${material.title}" loading="lazy">
            </div>
            <div class="card-content">
                <h3 class="card-title">${material.title}</h3>
                <p class="card-description">${material.description}</p>
            </div>
        </div>
    `).join('');

    catalog.innerHTML = html;
}

// =================================
// ПЕРЕХОД НА СТРАНИЦУ МАТЕРИАЛА
// =================================
function openMaterial(id) {
    window.location.href = `material.html?id=${id}`;
}

// =================================
// ФИЛЬТРАЦИЯ ПО КАТЕГОРИИ
// =================================
function filterByCategory(materials, categories, categorySlug) {
    // Если категория не указана — возвращаем все материалы
    if (!categorySlug) {
        return materials;
    }

    // Находим категорию по slug
    const category = categories.find(c => c.slug === categorySlug);
    
    if (!category) {
        return materials;
    }

    // Фильтруем материалы по ID категории
    return materials.filter(m => m.categoryId === category.id);
}

// =================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =================================
async function init() {
    // Проверяем авторизацию
    if (!checkAuth()) {
        return;
    }

    // Показываем loader
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    // Загружаем данные из JSON
    const data = await loadData();
    
    if (!data) {
        if (loader) loader.style.display = 'none';
        return;
    }

    // Получаем выбранную категорию из URL (?category=marketing)
    const urlParams = new URLSearchParams(window.location.search);
    const categorySlug = urlParams.get('category');

    // Рендерим категории
    renderCategories(data.categories, categorySlug);

    // Фильтруем материалы по категории
    const filteredMaterials = filterByCategory(
        data.materials, 
        data.categories, 
        categorySlug
    );

    // Рендерим карточки материалов
    renderMaterials(filteredMaterials);

    // Скрываем loader
    if (loader) loader.style.display = 'none';
}

// =================================
// ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// =================================
// Ждем полной загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
