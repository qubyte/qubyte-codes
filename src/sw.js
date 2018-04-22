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

  // if (request.cache === 'only-if-cache') {
  //   request.mode = 'same-origin';
  // }

  const responseFromFetch = fetch(request);
  const cachePromise = caches.open(cacheName);
  const clonedResponsePromise = responseFromFetch.then(res => res.clone());
  const cachedResponsePromise = Promise.all([cachePromise, clonedResponsePromise])
    .then(([cache, response]) => cache.put(request, response));

  // Extend the lifetime of this event until a fresh response has been cached.
  fetchEvent.waitUntil(cachedResponsePromise);

  // Always try to get fresh HTML before falling back on the cache.
  if (acceptHeader.includes('text/html')) {
    return fetchEvent.respondWith(responseFromFetch.catch(() => caches.match(request)));
  }

  // Try the cache first for oher things, and cache a fresh copy in the background.
  fetchEvent.respondWith(caches.match(request).then(matched => matched || responseFromFetch));
});
