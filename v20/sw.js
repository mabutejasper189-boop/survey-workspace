// sw.js - Dynamic Stale-While-Revalidate Strategy
const CACHE_NAME = 'survey-workspace-v4'; // Bumped version to force user browser updates

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './canvas.js',
  './drawing-tools.js',
  './pdf-export.js',
  './dxf-export.js',
  './storage.js',
  './save-as.js',
  './open.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[Service Worker] Failed to pre-cache ${asset}:`, err);
        }
      }
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).then(response => {
      const resClone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
      return response;
    }).catch(() => {
      return caches.match(e.request);
    })
  );
});