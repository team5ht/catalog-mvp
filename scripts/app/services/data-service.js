import { DATA_URL } from '../constants.js';

let appData = null;

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
    appData = data;
    return data;
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
