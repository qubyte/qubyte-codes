import createContainedSvg from './create-contained-svg.js';
import createSvgElement from './create-svg-element.js';
import mulberry32 from './mulberry32.js';
import getSeed from './get-seed.js';
import pick from './pick.js';

const SEED = getSeed();
const random = mulberry32(SEED);

console.log('SEED:', SEED);

const width = 600;
const height = 600;

const { container, svg } = createContainedSvg({
  className: 'experiment',
  width,
  height,
  'transform-origin': 'center'
});

const spokeLength = 260;
const spokeWidth = 10;

// Spines are at 30 degrees to the spoke.
const spines = pick([3, 4, 5, 6, 7], random);
const lengths = Array.from({ length: spines }, (_, i) => {
  return Math.max(spokeLength * random() * (i + 1) / (spines + 2) - 2 * spokeWidth, 0);
});

// Snowflakes have rotational symmetry. It's possible to do three double ended
// spokes, but I'll so size one sided ones.

for (let i = 0; i < 6; i++) {
  const group = createSvgElement('g', {
    transform: `translate(${300 - spokeWidth / 2}, 300) rotate(${60 * i}, ${spokeWidth / 2}, 0)`
  });

  const spoke = createSvgElement('rect', {
    x: 0,
    y: 0,
    rx: spokeWidth / 2,
    width: spokeWidth,
    height: spokeLength,
    'stroke-width': 0,
    fill: 'red'
  });

  group.appendChild(spoke);

  for (let j = 1; j < spines + 1; j++) {
    const offset = j * spokeLength / (spines + 2);
    const spineLeft = createSvgElement('rect', {
      x: 0,
      y: offset,
      rx: spokeWidth / 2,
      width: spokeWidth,
      height: lengths[j - 1],
      'stroke-width': 0,
      fill: 'red',
      transform: `rotate(-60, ${spokeWidth / 2}, ${offset})`
    });
    const spineRight = createSvgElement('rect', {
      x: 0,
      y: offset,
      rx: spokeWidth / 2,
      width: spokeWidth,
      height: lengths[j - 1],
      'stroke-width': 0,
      fill: 'red',
      transform: `rotate(60, ${spokeWidth / 2}, ${offset})`
    });

    group.appendChild(spineLeft);
    group.appendChild(spineRight);
  }

  svg.appendChild(group);
}

const svgCode = svg.outerHTML.replace('<svg ', '<?xml version="1.0" standalone="yes"?>\n<svg xmlns="http://www.w3.org/2000/svg" ');
const url = URL.createObjectURL(new Blob([svgCode], { type: 'application/svg' }));
const p = document.createElement('p');
const a = document.createElement('a');
p.appendChild(a);
a.href = url;
a.download = `snowflake-${SEED}.svg`;
a.textContent = 'Download as SVG.';

document.querySelector('.e-content').append(container, p);
