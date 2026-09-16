/* Small cache-first worker: the game is static, so once it is on the device it
   keeps working with no network at all. The page itself is the exception —
   it is fetched fresh when there is a network, otherwise an installed copy
   would keep serving yesterday's build forever. */
const CACHE = 'shikaky-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const fresh = (request) =>
  fetch(request).then((response) => {
    const copy = response.clone();
    void caches.open(CACHE).then((cache) => cache.put(request, copy));
    return response;
  });

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // A new deploy ships a new index.html pointing at new asset names, so the
  // page has to come from the network whenever the network is there.
  if (request.mode === 'navigate') {
    event.respondWith(
      fresh(request).catch(() =>
        caches.match(request).then((hit) => hit ?? caches.match('./index.html').then((fallback) => fallback ?? Response.error())),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fresh(request).catch(() =>
        caches.match('./index.html').then((fallback) => fallback ?? Response.error()),
      );
    }),
  );
});
