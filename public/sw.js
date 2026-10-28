const CACHE_NAME = 'xadrez-coach-v2';

self.addEventListener('install', (event) => {
  const scope = self.registration.scope;
  const assets = [
    scope,
    scope + 'index.html',
    scope + 'manifest.webmanifest',
    scope + 'favicon.svg',
    scope + 'favicon.png',
    scope + 'apple-touch-icon.png',
    scope + 'pwa-192x192.png',
    scope + 'pwa-512x512.png',
    scope + 'stockfish-19-lite-single.js',
    scope + 'stockfish-19-lite-single.wasm'
  ];

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        assets.map((asset) => {
          return fetch(asset)
            .then((res) => {
              if (res.ok) {
                return cache.put(asset, res);
              }
            })
            .catch((err) => {
              console.warn('[SW] Falha ao pré-cachear asset:', asset, err);
            });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Cache-first for wasm, static assets, images, js, css
  if (
    url.pathname.endsWith('.wasm') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Network-first for navigation requests with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            const scope = self.registration.scope;
            return caches.match(scope + 'index.html').then((indexCached) => {
              if (indexCached) return indexCached;
              return caches.match(scope);
            });
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
