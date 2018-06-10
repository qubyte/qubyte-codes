import Battenberg from '/scripts/battenberg.js';

let isActive = false;
let t = null;

const boxWidth = Math.min(400, parseInt(window.getComputedStyle(document.querySelector('.e-content')).width, 10));

const battenberg = new Battenberg({ boxWidth, φ: 0, θ: 0, ω: 0, δφ: 0.0001, δθ: 0.0002, δω: 0.001 });
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

function makeNumberInput({ labelText, min, max, value, onchange }) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = min;
  input.max = max;
  input.step = 1;
  input.value = value;
  input.onchange = onchange;
  input.style.width = `${Math.max(`${min}`.length, `${max}`.length) + 1}rem`;

  const label = document.createElement('label');
  label.textContent = labelText;
  label.appendChild(input);

  return label;
}

const rangeφ = makeNumberInput({ labelText: 'φ: ', min: 0, max: 20, value: battenberg.δφ * 10000, onchange() {
  battenberg.δφ = this.valueAsNumber / 10000; // eslint-disable-line no-invalid-this
} });

const rangeθ = makeNumberInput({ labelText: 'θ: ', min: 0, max: 20, value: battenberg.δθ * 10000, onchange() {
  battenberg.δθ = this.valueAsNumber / 10000; // eslint-disable-line no-invalid-this
} });

const rangeω = makeNumberInput({ labelText: 'ω: ', min: 0, max: 100, value: battenberg.δω * 10000, onchange() {
  battenberg.δω = this.valueAsNumber / 10000; // eslint-disable-line no-invalid-this
} });

const controls = document.createElement('div');
controls.style.margin = '1rem 0';
controls.appendChild(rangeφ);
controls.appendChild(document.createTextNode(' '));
controls.appendChild(rangeθ);
controls.appendChild(document.createTextNode(' '));
controls.appendChild(rangeω);
controls.appendChild(document.createTextNode(' '));
controls.appendChild(startStop);

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
