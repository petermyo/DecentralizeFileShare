const CACHE_NAME = 'dfile-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '192x192.png',
  '512x512.png'
  // You can add more assets here like CSS files or logos if you have them
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
