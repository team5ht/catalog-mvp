import { DATA_URL } from '../constants.js';

let appData = null;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeMaterial(material) {
  if (!material || typeof material !== 'object') {
    throw new Error('material must be an object');
  }

  const cover = material.cover;
  if (!cover || typeof cover !== 'object' || Array.isArray(cover)) {
    throw new Error(`Material ${material.id ?? 'unknown'}: cover must be an object`);
  }

  if (!isNonEmptyString(cover.asset)) {
    throw new Error(`Material ${material.id ?? 'unknown'}: cover.asset is required`);
  }
  if (!cover.asset.trim().startsWith('materials/')) {
    throw new Error(`Material ${material.id ?? 'unknown'}: cover.asset must start with "materials/"`);
  }

  if (!isNonEmptyString(cover.alt)) {
    throw new Error(`Material ${material.id ?? 'unknown'}: cover.alt is required`);
  }

  return {
    ...material,
    cover: {
      asset: cover.asset.trim(),
      alt: cover.alt.trim(),
      focalPoint: isNonEmptyString(cover.focalPoint) ? cover.focalPoint.trim() : '50% 50%'
    }
  };
}

function normalizeAppData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('data.json must contain an object');
  }

  if (!Array.isArray(data.categories)) {
    throw new Error('data.json: categories must be an array');
  }

  if (!Array.isArray(data.materials)) {
    throw new Error('data.json: materials must be an array');
  }

  return {
    ...data,
    materials: data.materials.map((material) => normalizeMaterial(material))
  };
}

export async function loadAppData() {
  if (appData) {
    return appData;
  }

  try {
    const response = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Response not ok: ${response.status}`);
    }

    const data = await response.json();
    appData = normalizeAppData(data);
    return appData;
  } catch (error) {
    console.warn('Не удалось загрузить data.json', error);
    appData = null;
    throw error;
  }
}

export function getCategoryNameById(categoryId) {
  if (!appData || !Array.isArray(appData.categories)) {
    return 'Материал';
  }

  const category = appData.categories.find((item) => item.id === categoryId);
  return category ? category.name : 'Материал';
}
