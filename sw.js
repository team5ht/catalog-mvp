// =================================
// SERVICE WORKER ДЛЯ PWA
// Обеспечивает работу оффлайн и установку на устройство
// =================================

const CACHE_NAME = 'catalog-mvp-v4';
const AUTH_CACHE_NAME = 'catalog-mvp-auth-sync-v1';

// Список файлов для кэширования (оффлайн доступ)
// Используем относительные пути для совместимости с подпапками
const urlsToCache = [
  './',
  './index.html',
  './catalog.html',
  './material.html',
  './auth-login.html',
  './auth-check-email.html',
  './auth-callback.html',
  './login.html',
  './app.js',
  './auth-state.js',
  './nav-auth.js',
  './supabase-client.js',
  './data.json',
  './manifest.json',
  './styles/tokens.css',
  './styles/base.css',
  './styles/components/buttons.css',
  './styles/components/cards.css',
  './styles/components/scroll-containers.css',
  './styles/components/navigation.css',
  './styles/pages/catalog.css',
  './styles/pages/material.css',
  './styles/pages/login.css',
  './banner.png',
  './icon-192.png',
  './icon-512.png'
];

async function persistAuthSession(session) {
  // Храним последнюю сессию, чтобы установить её в PWA даже если ссылка открыта во внешнем браузере
  try {
    const cache = await caches.open(AUTH_CACHE_NAME);
    await cache.put('auth-session', new Response(JSON.stringify(session || {}), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (err) {
    console.warn('Service Worker: не удалось сохранить auth-сессию', err);
  }
}

async function readPersistedAuthSession() {
  try {
    const cache = await caches.open(AUTH_CACHE_NAME);
    const stored = await cache.match('auth-session');
    if (!stored) {
      return null;
    }
    const parsed = await stored.json();
    if (parsed && parsed.access_token && parsed.refresh_token) {
      return parsed;
    }
  } catch (err) {
    console.warn('Service Worker: не удалось прочитать auth-сессию', err);
  }
  return null;
}

async function broadcastAuthSession(session) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: 'auth-session', session }));
}

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Установка');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Кэширование файлов');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Активировать сразу
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
          if (cacheName !== CACHE_NAME && cacheName !== AUTH_CACHE_NAME) {
            console.log('Service Worker: Удаление старого кэша', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  return self.clients.claim();
});

// Прокидываем полученную по magic-link сессию в открытые клиенты и сохраняем для будущих загрузок PWA
self.addEventListener('message', (event) => {
  const data = event && event.data ? event.data : null;
  if (!data || !data.type) {
    return;
  }

  if (data.type === 'auth-session' && data.session) {
    event.waitUntil((async () => {
      await persistAuthSession(data.session);
      await broadcastAuthSession(data.session);
    })());
  }

  if (data.type === 'auth-session-request') {
    event.waitUntil((async () => {
      const storedSession = await readPersistedAuthSession();
      if (storedSession && event.source) {
        event.source.postMessage({ type: 'auth-session', session: storedSession });
      }
    })());
  }
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
