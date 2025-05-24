const CACHE_NAME = 'calendar-v1';
const ASSETS = [
  '/miniapps/calendar/index.html',
  '/miniapps/calendar/calendar.js',
  '/miniapps/calendar/style.css',
  '/miniapps/calendar/notify.mp3'
];

// Установка и кэширование
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Активация
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
    )
  );
});

// Стратегия кэширования
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Обработка уведомлений
self.addEventListener('notificationclick', event => {
  event.notification.close();
  clients.openWindow('/miniapps/calendar/index.html');
});
