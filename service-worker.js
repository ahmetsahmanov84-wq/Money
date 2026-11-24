// Service Worker: офлайн-работа после первой загрузки.
const VERSION = 'mt-v2.1.1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/format.js',
  './js/icons.js',
  './js/categories.js',
  './js/ui.js',
  './js/forms.js',
  './js/screens/home.js',
  './js/screens/categories.js',
  './js/screens/income.js',
  './js/screens/analytics.js',
  './js/screens/debts.js',
  './js/screens/calendar.js',
  './js/screens/settings.js',
  './js/security.js',
  './js/export.js',
  './js/fx.js',
  './assets/img/hero-home.png',
  './assets/img/hero-categories.png',
  './assets/img/hero-income.png',
  './assets/img/hero-analytics.png',
  './assets/img/hero-debts.png',
  './assets/img/hero-calendar.png',
  './assets/img/hero-settings.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала кэш, затем сеть; новые файлы докладываются в кэш
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    })
  );
});
