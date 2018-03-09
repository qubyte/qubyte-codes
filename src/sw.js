// HTML files: try the network first, then the cache.
// Other files: try the cache first, then the network.
// Both: cache a fresh version if possible.
// Ignore EventSource.
// (beware: the cache will grow and grow; there's no cleanup)

addEventListener('fetch',  fetchEvent => {
  const cacheName = 'v1';
  const request = fetchEvent.request;
  const acceptHeader = request.headers.get('Accept');

  if (request.method !== 'GET' || acceptHeader.includes('text/event-stream')) {
    return;
  }

  fetchEvent.respondWith(async function() {
    const responseFromFetch = fetch(request);

    fetchEvent.waitUntil(async function() {
      const responseCopy = (await responseFromFetch).clone();
      const myCache = await caches.open(cacheName);
      await myCache.put(request, responseCopy);
    }());

    if (acceptHeader.includes('text/html')) {
      try {
        return await responseFromFetch;
      } catch(error) {
        return caches.match(request);
      }
    }

    return (await caches.match(request)) || responseFromFetch;
  }());
});
