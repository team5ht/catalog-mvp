import { HOME_HASH } from '../constants.js';
import { getSpaRoot } from '../dom.js';
import { buildAuthHash } from '../routing/hash.js';
import { navigateTo } from '../routing/navigation.js';
import { getCategoryNameById, loadAppData } from '../services/data-service.js';
import {
  canGoBackInApp,
  isCurrentRender
} from '../state.js';
import {
  isAuthenticated,
  refreshAuthSession
} from '../services/auth-service.js';

export function renderDownloadButtonState(button) {
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

export async function renderMaterialView(route, renderToken) {
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
