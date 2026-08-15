const CACHE_NAME = 'gymledger-shell-v2.0.7';
const SHELL = [
  './','./index.html','./offline.html','./manifest.webmanifest','./css/styles.css',
  './js/app.js','./js/constants.js','./js/utils.js','./js/db.js','./js/schema.js','./js/seed-data.js','./js/exercise-catalog.js',
  './js/auth.js','./js/cloud-config.js','./js/cloud.js','./js/sync.js','./js/gym-service.js','./js/import-export.js',
  './js/views/home.js','./js/views/exercises.js','./js/views/routines.js','./js/views/plans.js','./js/views/sessions.js','./js/views/settings.js',
  './VERSION.txt','./assets/icons/icon-96.png','./assets/icons/icon-192.png','./assets/icons/icon-512.png','./assets/icons/icon-maskable-192.png','./assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gymledger-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => {
      const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy)); return response;
    }).catch(async () => (await caches.match('./index.html')) || (await caches.match('./offline.html'))));
    return;
  }
  event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request)));
});
