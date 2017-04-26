(function () {
  'use strict';

  var CACHE_NAME = 'qubyte-codes-cache-v1';

  var sitemapPromise = (async function () {
    const res = await fetch('/sw-sitemap.txt');

    if (!res.ok) {
      throw new Error('Unexpected status when acquiring sitemap: ' + res.status);
    }

    const pages = await res.text();

    return pages.trim().split('\n');
  }());

  var cachePromise = caches.open(CACHE_NAME);

  self.addEventListener('install', function (event) {
    async function populateCache() {
      const [sitemap, cache] = await Promise.all([sitemapPromise, cachePromise]);

      return cache.addAll(sitemap);
    }

    event.waitUntil(populateCache());
  });

  self.addEventListener('fetch', function (event) {
    async function getResponse() {
      const responseFromCache = await caches.match(event.request);

      if (responseFromCache) {
        return responseFromCache;
      }

      const fetchResponse = await fetch(event.request.clone());

      if (fetchResponse && fetchResponse.status === 200 && fetchResponse.type === 'basic') {
        cachePromise.then(cache => cache.put(event.request, fetchResponse.clone()));
      }

      return fetchResponse;
    }

    event.respondWith(getResponse());
  });

  self.addEventListener('activate', function (event) {
    async function scrubOldCaches() {
      const names = await caches.keys();
      const deletePromises = [];

      for (const name of cacheNames) {
        if (name !== CACHE_NAME) {
          deletePromises.push(caches.delete(cacheName));
        }
      }

      return Promise.all(deletePromises)
    }

    event.waitUntil(scrubOldCaches);
  });
}());
