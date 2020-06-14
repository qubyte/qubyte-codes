if (navigator.serviceWorker && !navigator.serviceWorker.controller) {
  navigator.serviceWorker.register('/sw.js');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applySettings);
} else {
  applySettings();
}

function applySettings() {
  'use strict';

  // Hide or show ruby test.
  if (localStorage.getItem('ruby-hide')) {
    document.body.classList.add('ruby-hide');
  }

  // Position ruby text.
  const rubyPosition = localStorage.getItem('ruby-position');

  if (rubyPosition) {
    document.body.classList.add(`ruby-position-${rubyPosition}`);
  }

  // Colour scheme.
  const colorScheme = localStorage.getItem('color-scheme');

  if (colorScheme) {
    document.body.classList.add(`color-scheme-${colorScheme}`);
  }
}
