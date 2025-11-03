// =================================
// SERVICE WORKER ДЛЯ PWA
// Обеспечивает работу оффлайн и установку на устройство
// =================================

const CACHE_NAME = 'catalog-mvp-v2';

// Список файлов для кэширования (оффлайн доступ)
// Используем относительные пути для совместимости с подпапками
const urlsToCache = [
  './',
  './index.html',
  './material.html',
  './login.html',
  './style.css',
  './app.js',
  './data.json',
  './manifest.json'
];

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
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Если есть в кэше — возвращаем из кэша
        if (response) {
          return response;
        }
        
        // Иначе загружаем из сети
        return fetch(event.request)
          .then(response => {
            // Проверяем корректность ответа
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Клонируем ответ (response можно прочитать только раз)
            const responseToCache = response.clone();
            
            // Сохраняем в кэш для следующего раза
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Если нет сети и нет в кэше — показываем fallback
            return caches.match('./index.html');
          });
      })
  );
});
