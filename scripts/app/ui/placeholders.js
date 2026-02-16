import { createResponsivePicture } from './responsive-image.js';

export function renderInlineError(containerId, message) {
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

export function renderMaterialsSkeleton(containerId, limit = 5) {
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

export function renderCategoriesSkeleton(limit = 5) {
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

export function renderCatalogSkeleton(limit = 4) {
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

export function renderMaterialsCarousel(containerId, materials, limit = 5) {
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
    cover.appendChild(
      createResponsivePicture({
        asset: material.cover.asset,
        alt: material.cover.alt,
        focalPoint: material.cover.focalPoint,
        preset: 'coverCarousel'
      })
    );

    const title = document.createElement('p');
    title.className = 'material-card__title';
    title.textContent = material.title;

    card.appendChild(cover);
    card.appendChild(title);
    container.appendChild(card);
  });
}
