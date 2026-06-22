/*
 * service-worker.js
 *
 * This service worker implements a very simple offline‑first caching strategy.
 * When installed it pre‑caches the core assets that comprise the game shell
 * (HTML, CSS, JavaScript, manifest and icons). During fetch events it
 * attempts to serve requests from the cache first, falling back to the
 * network if they aren’t available. Navigational requests that fail due to
 * being offline are redirected to an offline fallback page.
 */

const CACHE_NAME = 'highriskwars-v1';

// List of resources to cache during install. These are relative to the
// service worker’s scope (the root of the PWA).
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/offline.html',
  '/icon-32.png',
  '/icon-64.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-192.png',
  '/icon-256.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  // Pre-cache core assets; tolerate individual failures so install still completes.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(ASSETS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete old caches when a new version is activated.
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // For navigation requests, attempt to respond with cached content first.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
    return;
  }

  // For other requests (styles, scripts, images), try the cache then network.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).then((networkResponse) => {
          // Dynamically cache the fetched resource for future use.
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => {
          // If both network and cache fail, and this is an image, fall back to
          // the largest available icon.
          if (event.request.destination === 'image') {
            return caches.match('/icon-256.png');
          }
        })
      );
    })
  );
});