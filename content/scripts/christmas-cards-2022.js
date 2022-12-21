import createContainedSvg from './create-contained-svg.js';
import createSvgElement from './create-svg-element.js';
import mulberry32 from './mulberry32.js';
import getSeed from './get-seed.js';
import randomInRange from './random-in-range.js';

const SEED = getSeed();
const random = mulberry32(SEED);
const randRange = (min, max) => randomInRange(min, max, random);

console.log('SEED:', SEED);

const width = 600;
const height = 400;

const { container, svg } = createContainedSvg({
  className: 'experiment',
  width,
  height,
  'transform-origin': 'center'
});

// A snowman is three cirles. The base is the largest.
const baseDiameter = randomInRange(120, 150, random);
const tummyDiameter = randomInRange(90, baseDiameter - 10, random);
const headDiameter = randomInRange(60, tummyDiameter - 10, random);

const baseCenter = -baseDiameter / 2;
const tummyCenter = -baseDiameter - tummyDiameter / 4;
const tummyOffset = randRange(-10, 10);
const headCenter = -baseDiameter - 3 * tummyDiameter / 4 - headDiameter / 4;

const group = createSvgElement('g', { transform: `translate(${width / 2}, ${height})` });

const groundGroup = createSvgElement('g');
groundGroup.append(
  createSvgElement('path', {
    d: `M-120,0 v-20 q${randRange(50, 70)},${randRange(-15, 15)} 120,0 q${randRange(50, 70)},${randRange(-15, 15)} 120,0 v20 Z`,
    fill: 'red'
  })
);

const bodyGroup = createSvgElement('g');
const base = createSvgElement('circle', { cx: 0, cy: baseCenter, r: baseDiameter / 2, fill: 'red' });
const tummy = createSvgElement('circle', { cx: 0 + tummyOffset, cy: tummyCenter, r: tummyDiameter / 2, fill: 'red' });
const head = createSvgElement('circle', { cx: 0, cy: headCenter, r: headDiameter / 2, fill: 'red' });

bodyGroup.append(base, tummy, head);

const headPenGroup = createSvgElement('g', { transform: `translate(0, ${headCenter})` });
const mouthRangeHorizontal = randRange(3 * headDiameter / 16, headDiameter / 4);
const mouthRangeHorizontalOffset = (2 * random() - 1) * headDiameter / 8;

const bodyPenGroup = createSvgElement('g');

bodyPenGroup.append(
  createSvgElement('circle', { cx: 0 + tummyOffset * 1.5, cy: tummyCenter - tummyDiameter / 4, r: 8, fill: 'white' }),
  createSvgElement('circle', { cx: 0 + tummyOffset * 2, cy: tummyCenter, r: 8, fill: 'white' }),
  createSvgElement('circle', { cx: 0 + tummyOffset * 1.5, cy: tummyCenter + tummyDiameter / 4, r: 8, fill: 'white' })
);

headPenGroup.append(
  createSvgElement('circle', { cx: mouthRangeHorizontalOffset - 12 + randRange(-1, 1), cy: -7 - randRange(0, 4), r: 4, fill: 'white' }),
  createSvgElement('circle', { cx: mouthRangeHorizontalOffset + 12 + randRange(-1, 1), cy: -7 - randRange(0, 4), r: 4, fill: 'white' }),
  createSvgElement('circle', { cx: mouthRangeHorizontalOffset, cy: 0, r: 5, fill: 'white' }),
  createSvgElement('circle', {
    cx: randRange(0, 2) - mouthRangeHorizontal + mouthRangeHorizontalOffset,
    cy: 5 + randRange(0, 2),
    r: headDiameter / 30,
    fill: 'white'
  }),
  createSvgElement('circle', {
    cx: randRange(0, 2) - mouthRangeHorizontal / 2 + mouthRangeHorizontalOffset,
    cy: 5 + randRange(0, 2) + 5,
    r: headDiameter / 30,
    fill: 'white'
  }),
  createSvgElement('circle', {
    cx: randRange(0, 2) + mouthRangeHorizontalOffset,
    cy: 5 + randRange(0, 2) + 7,
    r: headDiameter / 30,
    fill: 'white'
  }),
  createSvgElement('circle', {
    cx: randRange(0, 2) + mouthRangeHorizontal / 2 + mouthRangeHorizontalOffset,
    cy: 5 + randRange(0, 2) + 5,
    r: headDiameter / 30,
    fill: 'white'
  }),
  createSvgElement('circle', {
    cx: randRange(0, 2) + mouthRangeHorizontal + mouthRangeHorizontalOffset,
    cy: 5 + randRange(0, 2),
    r: headDiameter / 30,
    fill: 'white'
  })
);

group.append(bodyGroup, bodyPenGroup, headPenGroup, groundGroup);
svg.appendChild(group);

const svgCode = svg.outerHTML.replace('<svg ', '<?xml version="1.0" standalone="yes"?>\n<svg xmlns="http://www.w3.org/2000/svg" ');
const url = URL.createObjectURL(new Blob([svgCode], { type: 'application/svg' }));
const p = document.createElement('p');
const a = document.createElement('a');
p.appendChild(a);
a.href = url;
a.download = `snowman-${SEED}.svg`;
a.textContent = 'Download as SVG.';

document.querySelector('.e-content').append(container, p);
