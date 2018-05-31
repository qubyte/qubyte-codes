import Battenberg from '/scripts/battenberg.js';

let isActive = false;
let t = null;

const battenberg = new Battenberg({ φ: 0, θ: 0, ω: 0, δφ: 0.0001, δθ: 0.0002, δω: 0.001 });
battenberg.update(0);
battenberg.draw();

const startStop = document.createElement('button');
startStop.textContent = 'start';
startStop.onclick = () => {
  isActive = !isActive;

  if (isActive) {
    window.requestAnimationFrame(step);
    startStop.textContent = 'stop';
  } else {
    t = null;
    startStop.textContent = 'start';
  }
};

const ringφ = document.createElement('input');
ringφ.type = 'range';
ringφ.min = 0;
ringφ.max = 20;
ringφ.value = battenberg.δφ * 10000;
ringφ.onchange = function () {
  battenberg.δφ = ringφ.valueAsNumber / 10000;
};

const ringθ = document.createElement('input');
ringθ.type = 'range';
ringθ.min = 0;
ringθ.max = 20;
ringθ.value = battenberg.δθ * 10000;
ringθ.onchange = function () {
  battenberg.δθ = ringθ.valueAsNumber / 10000;
};

const ringω = document.createElement('input');
ringω.type = 'range';
ringω.min = 0;
ringω.max = 100;
ringω.value = battenberg.δω * 10000;
ringω.onchange = function () {
  battenberg.δω = ringω.valueAsNumber / 10000;
};

const controls = document.createElement('div');
controls.appendChild(startStop);
controls.appendChild(ringφ);
controls.appendChild(ringθ);
controls.appendChild(ringω);

const container = document.createElement('div');
container.style.textAlign = 'center';
container.appendChild(battenberg.svg);
container.appendChild(controls);

document.querySelector('.e-content').appendChild(container);

function step(timestamp) {
  if (!isActive) {
    return;
  }

  if (!t) {
    t = timestamp;
  }

  const dt = timestamp - t;

  t = timestamp;

  battenberg.update(dt);
  battenberg.draw();

  window.requestAnimationFrame(step);
}
