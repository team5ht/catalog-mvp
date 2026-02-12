// =================================
// SERVICE WORKER ДЛЯ PWA
// SPA shell + оффлайн поддержка
// =================================

const CACHE_NAME = 'catalog-mvp-v15';

const urlsToCache = [
  './',
  './index.html',
  './scripts/app.js',
  './scripts/app/bootstrap.js',
  './scripts/app/constants.js',
  './scripts/app/dom.js',
  './scripts/app/state.js',
  './scripts/app/platform/orientation-guard.js',
  './scripts/app/platform/service-worker-registration.js',
  './scripts/app/routing/hash.js',
  './scripts/app/routing/navigation.js',
  './scripts/app/routing/router.js',
  './scripts/app/services/auth-service.js',
  './scripts/app/services/data-service.js',
  './scripts/app/ui/placeholders.js',
  './scripts/app/ui/shell.js',
  './scripts/app/views/account-view.js',
  './scripts/app/views/auth-view.js',
  './scripts/app/views/catalog-view.js',
  './scripts/app/views/home-view.js',
  './scripts/app/views/material-view.js',
  './scripts/nav-auth.js',
  './scripts/supabase-client.js',
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (error) {
          console.warn('Service Worker: Пропуск ресурса при кэшировании', url, error);
        }
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    })
  );

  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
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
          const shell = await cache.match('./index.html');
          if (shell) {
            return shell;
          }
        }

        throw error;
      }
    })()
  );
});

