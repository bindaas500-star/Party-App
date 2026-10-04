/* Party App Service Worker — app-shell caching + offline fallback.
   Ise index.html se register kiya jata hai (neeche di hui snippet dekho). */

const CACHE_NAME = 'party-app-v1';

const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: app shell cache karo
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: purane caches saaf karo
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Firebase / googleapis / cdnjs calls: hamesha network (kabhi cache mat karo)
// - Page navigations: network-first, fail par offline.html
// - Baqi static files: cache-first, phir network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Backend / third-party calls kabhi cache nahi honge
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('firestore.googleapis.com')
  ) {
    return; // default network behaviour
  }

  // Sirf GET requests handle karo
  if (event.request.method !== 'GET') return;

  // Navigation (page loads): network-first + offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('./offline.html')
      )
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Sirf apni domain ki successful files cache karo
        if (
          response.ok &&
          url.origin === self.location.origin
        ) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, copy)
          );
        }
        return response;
      });
    })
  );
});
