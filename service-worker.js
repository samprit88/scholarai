const CACHE_NAME = 'scholarai-v10';
const FILE_CACHE_NAME = 'scholarai-file-blobs-v1';
const FILE_CACHE_PREFIX = '/__scholarai_file_cache/';
const APP_ASSETS = [
  './',
  'index.html',
  'login.html',
  'firebase-config.js',
  'styles.css',
  'db.js',
  'aria.js',
  'notifications.js',
  'script.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];
const smartCalendarTimers = new Map();

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => (cacheName === CACHE_NAME || cacheName === FILE_CACHE_NAME) ? null : caches.delete(cacheName))
    ))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'SMART_CALENDAR_CLEAR') {
    smartCalendarTimers.forEach(timer => clearTimeout(timer));
    smartCalendarTimers.clear();
  }
  if (event.data?.type === 'SMART_CALENDAR_SCHEDULE') {
    const delay = Number(event.data.delay || 0);
    const eventId = event.data.eventId || String(Date.now());
    if (smartCalendarTimers.has(eventId)) clearTimeout(smartCalendarTimers.get(eventId));
    if (delay > 0 && delay <= 2147483647) {
      const timer = setTimeout(() => {
        smartCalendarTimers.delete(eventId);
        self.registration.showNotification(event.data.title || 'ScholarAI Reminder', {
          body: event.data.body || 'You have a reminder.',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: 'smart-calendar-' + eventId,
          renotify: true,
          data: { url: './', eventId }
        }).catch(() => {});
      }, delay);
      smartCalendarTimers.set(eventId, timer);
    }
  }
  if (event.data?.type === 'SMART_CALENDAR_NOTIFY') {
    const title = event.data.title || 'ScholarAI Reminder';
    const body = event.data.body || 'You have a reminder.';
    event.waitUntil(self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'smart-calendar-' + (event.data.eventId || Date.now()),
      renotify: true,
      data: { url: './', eventId: event.data.eventId || '' }
    }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return null;
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) return;

  if (url.pathname.startsWith(FILE_CACHE_PREFIX)) {
    event.respondWith(caches.match(event.request).then(cached => cached || new Response('File is not cached on this device.', { status: 404 })));
    return;
  }

  if (url.hostname.includes('firebasestorage.googleapis.com') || url.hostname.includes('storage.googleapis.com')) {
    event.respondWith(
      caches.open(FILE_CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const fresh = fetch(event.request).then(response => {
            if (response && response.status === 200) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached || Response.error());
          return cached || fresh;
        })
      )
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('index.html')))
    );
    return;
  }

  // Network-first keeps users on the newest app files, with cache as an offline fallback.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
