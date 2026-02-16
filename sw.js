// =================================
// SERVICE WORKER ДЛЯ PWA
// SPA shell + runtime image cache
// =================================

const SHELL_CACHE_NAME = 'catalog-mvp-shell-v16';
const IMAGE_CACHE_NAME = 'catalog-mvp-images-v16';
const ACTIVE_CACHES = [SHELL_CACHE_NAME, IMAGE_CACHE_NAME];

const shellPrecacheUrls = [
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
  './scripts/app/ui/responsive-image.js',
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
  './assets/images/generated/home/hero-960.webp',
  './assets/images/generated/home/hero-960.jpg',
  './icon-192.png',
  './icon-512.png'
];

function isGeneratedImageRequest(url) {
  return url.pathname.includes('/assets/images/generated/');
}

async function cacheShellResources() {
  const cache = await caches.open(SHELL_CACHE_NAME);

  for (const url of shellPrecacheUrls) {
    try {
      await cache.add(url);
    } catch (error) {
      console.warn('Service Worker: пропуск ресурса в precache', url, error);
    }
  }
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map((cacheName) => {
      if (!ACTIVE_CACHES.includes(cacheName)) {
        return caches.delete(cacheName);
      }
      return Promise.resolve();
    })
  );
}

async function handleGeneratedImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    void fetchPromise;
    return cachedResponse;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  throw new Error('Image request failed and cache miss');
}

async function handleShellRequest(request) {
  const cache = await caches.open(SHELL_CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) {
        return shell;
      }
    }

    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await cacheShellResources();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await cleanupOldCaches();
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (isGeneratedImageRequest(requestUrl)) {
    event.respondWith(handleGeneratedImageRequest(event.request));
    return;
  }

  event.respondWith(handleShellRequest(event.request));
});
