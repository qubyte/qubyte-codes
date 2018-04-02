if (navigator.serviceWorker && !navigator.serviceWorker.controller) {
  navigator.serviceWorker.register('/sw.js');
}
