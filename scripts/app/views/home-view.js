import { getSpaRoot } from '../dom.js';
import { getLoadedAppData, loadAppData } from '../services/data-service.js';
import { isCurrentRender } from '../state.js';
import { createResponsivePicture } from '../ui/responsive-image.js';
import {
  renderInlineError,
  renderMaterialsCarousel,
  renderMaterialsSkeleton
} from '../ui/placeholders.js';

export function renderHomeView(renderToken) {
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
          <div id="homeHeroImage" class="home-banner__image"></div>
          <div class="home-banner__content">
            <p class="home-banner__title">Предложите новый материал</p>
            <p class="home-banner__subtitle">Отправьте идею в каталог.</p>
          </div>
        </a>
      </section>
      <section class="materials-section ui-enter">
        <div class="materials-section__header">
          <h2 class="materials-section__title">Новое</h2>
          <span class="materials-section__action">Подборка</span>
        </div>
        <div id="main-materials" class="materials-carousel"></div>
      </section>
      <section class="materials-section ui-enter">
        <div class="materials-section__header">
          <h2 class="materials-section__title">Популярное</h2>
          <span class="materials-section__action">ТОП-5</span>
        </div>
        <div id="materials-5ht" class="materials-carousel"></div>
      </section>
    `;

  return viewNode;
}

function renderHomeContentFromData(root, data) {
  renderMaterialsCarousel('main-materials', data.materials);
  renderMaterialsCarousel('materials-5ht', data.materials);
  homeHydrated = true;
  root.setAttribute('aria-busy', 'false');
}

function ensureHomeLoadPromise() {
  if (!homeLoadPromise) {
    homeLoadPromise = loadAppData()
      .finally(() => {
        homeLoadPromise = null;
      });
  }

  return homeLoadPromise;
}

export function renderHomeView(renderToken) {
  const root = getSpaRoot();
  if (!root) {
    return;
  }
  root.setAttribute('aria-busy', 'true');

  const firstMount = homeViewNode === null;
  if (firstMount) {
    homeViewNode = createHomeViewNode();
  }

  if (root.firstElementChild !== homeViewNode || root.childElementCount !== 1) {
    root.replaceChildren(homeViewNode);
  }

  if (firstMount) {
    const heroContainer = document.getElementById('homeHeroImage');
    if (heroContainer) {
      const heroPicture = createResponsivePicture({
        asset: 'home/hero',
        alt: 'Баннер приглашения к участию',
        preset: 'homeHero'
      });
      heroContainer.appendChild(heroPicture);
    }
  }

  if (homeHydrated) {
    root.setAttribute('aria-busy', 'false');
    return;
  }

  const cachedData = getLoadedAppData();
  if (cachedData && Array.isArray(cachedData.materials)) {
    renderMaterialsCarousel('main-materials', cachedData.materials);
    renderMaterialsCarousel('materials-5ht', cachedData.materials);
    root.setAttribute('aria-busy', 'false');
    return;
  }

  renderMaterialsSkeleton('main-materials', 5);
  renderMaterialsSkeleton('materials-5ht', 5);

  void ensureHomeLoadPromise()
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
