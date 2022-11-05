if (navigator.serviceWorker && !navigator.serviceWorker.controller) {
  navigator.serviceWorker.register('/sw.js');
}

if (document.readyState !== 'complete') {
  window.addEventListener('load', setupParty, false);
} else {
  setupParty();
}

function setupParty() {
  'use strict';

  let partyOn = false;
  let previous = null;
  let hue = parseInt(
    window
      .getComputedStyle(document.body)
      .getPropertyValue('--base-background-hue'),
    10
  );

  window.toggleParty = () => {
    if (partyOn) {
      partyOn = false;
      previous = null;
      return;
    }

    partyOn = true;

    function updateParty(now) {
      if (!partyOn) {
        return;
      }

      const dt = previous === null ? 0 : now - previous;

      previous = now;
      hue = (hue + dt / 10) % 256;
      document.documentElement.style.setProperty('--base-background-hue', hue);
      window.requestAnimationFrame(updateParty);
    }

    window.requestAnimationFrame(updateParty);
  };

  const $partyButton = document.querySelector('.party');

  if ($partyButton) {
    $partyButton.onclick = window.toggleParty;
  }
}
