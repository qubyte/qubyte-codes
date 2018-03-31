if (navigator.serviceWorker && !navigator.serviceWorker.controller) {
  navigator.serviceWorker.register('/sw.js');
}

(function () {
  'use strict';

  window.updateBackground = function (hue, saturation, luminoscity) {
    document.documentElement.style.setProperty('--base-background-hue', hue);
    document.documentElement.style.setProperty('--base-background-sat', `${saturation}%`);
    document.documentElement.style.setProperty('--base-background-lum', `${luminoscity}%`);
  };

  window.updateForeground = function (hue, saturation, luminoscity) {
    document.documentElement.style.setProperty('--base-foreground-hue', hue);
    document.documentElement.style.setProperty('--base-foreground-sat', `${saturation}%`);
    document.documentElement.style.setProperty('--base-foreground-lum', `${luminoscity}%`);
  };
}());
