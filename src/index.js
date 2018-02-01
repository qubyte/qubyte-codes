/* eslint no-console: off */
/* eslint-env browser */
'use strict';

if ('serviceWorker' in window.navigator) {
  window.addEventListener('load', () => {
    window.navigator.serviceWorker.register('/sw.js').then(
      registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      },
      err => {
        console.log('ServiceWorker registration failed: ', err);
      }
    );
  });
}
