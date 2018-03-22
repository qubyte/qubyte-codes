// HTML files: try the network first, then the cache.
// Other files: try the cache first, then the network.
// Both: cache a fresh version if possible.
// Ignore EventSource.
// (beware: the cache will grow and grow; there's no cleanup)
/* eslint-env serviceworker */

addEventListener('fetch', fetchEvent => {
  'use strict';

  const cacheName = 'v1';
  const request = fetchEvent.request;
  const acceptHeader = request.headers.get('Accept');

  if (request.method !== 'GET' || acceptHeader.includes('text/event-stream')) {
    return;
  }

  if (request.cache === 'only-if-cache') {
    request.mode = 'same-origin';
  }

  fetchEvent.respondWith((async () => {
    const responseFromFetch = fetch(request);

    fetchEvent.waitUntil((async () => {
      const responseCopy = (await responseFromFetch).clone();
      const myCache = await caches.open(cacheName);
      await myCache.put(request, responseCopy);
    })());

    if (acceptHeader.includes('text/html')) {
      try {
        return await responseFromFetch;
      } catch (error) {
        return caches.match(request);
      }
    }

    return (await caches.match(request)) || responseFromFetch;
  })());
});
