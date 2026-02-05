// =================================
// SERVICE WORKER ДЛЯ PWA
// Обеспечивает работу оффлайн и установку на устройство
// =================================

const CACHE_NAME = 'catalog-mvp-v8';

// Список файлов для кэширования (оффлайн доступ)
// Используем относительные пути для совместимости с подпапками
const urlsToCache = [
  './',
  './index.html',
  './catalog.html',
  './material.html',
  './account.html',
  './auth-login.html',
  './app.js',
  './nav-auth.js',
  './supabase-client.js',
  './data.json',
  './manifest.json',
  './styles/tokens.css',
  './styles/ui.css',
  './styles/pages.css',
  './assets/icons/sprite.svg',
  './home-hero.png',
  './icon-192.png',
  './icon-512.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Установка');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('Service Worker: Кэширование файлов');

      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (error) {
          console.warn('Service Worker: Пропуск ресурса при кэшировании', url, error);
        }
      }

      await self.skipWaiting(); // Активировать сразу
    })()
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Активация');
  
  // Удаляем старые кэши
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Удаление старого кэша', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  return self.clients.claim();
});

// Обработка запросов (стратегия: сначала кэш, потом сеть)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // Для сторонних ресурсов оставляем стандартное поведение браузера
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      const networkResponse = await fetch(event.request);

      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        cache.put(event.request, networkResponse.clone());
      }

      return networkResponse;
    } catch (error) {
      const cachedResponse = await cache.match(event.request);

      if (cachedResponse) {
        return cachedResponse;
      }

      if (event.request.mode === 'navigate') {
        return cache.match('./index.html');
      }

      throw error;
    }
  })());
});
