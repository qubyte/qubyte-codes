import createContainedSvg from './create-contained-svg.js';
import createSvgElement from './create-svg-element.js';
import pick from './pick.js';

const width = 600;
const height = 600;

const { container, svg } = createContainedSvg({ className: 'experiment', width, height, 'shape-rendering': 'crispEdges' });

document.querySelector('.e-content').appendChild(container);

function drawRect({ x, y, width, height, fill }) {
  svg.appendChild(createSvgElement('rect', { x, y, width, height, 'stroke-width': 0, fill }));
}

function draw({ x, y, width, height, colors }) {
  drawRect({ x, y, width, height, fill: pick(colors).toString() });
}

function drawPatch({ x: x0, y: y0, width, height, depth, colors }) {
  // Each patch is split into quadrants.
  const rows = 2;
  const cols = 2;
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  for (let i = 0; i < cols; i++) {
    const x = x0 + i * cellWidth;

    for (let j = 0; j < rows; j++) {
      const y = y0 + j * cellHeight;

      if (depth > 5 || Math.random() < 0.5) {
        draw({ x, y, width: cellWidth, height: cellHeight, colors });
      } else {
        drawPatch({ x, y, width: cellWidth, height: cellHeight, depth: depth + 1, colors });
      }
    }
  }
}

const hue = Math.round(Math.random() * 360);
const chroma = 60 + 75 * Math.random();
const lightness = 100;
const nColors = 1 + Math.random() * 5;

async function getMakeColor() {
  if (CSS.supports('color', 'lch(100% 0 0)')) {
    return (l, c, h) => `lch(${l}% ${c} ${h})`;
  }

  const { default: lch2rgb } = await import('./lch2rgb.js');

  return (l, c, h) => `rgb(${lch2rgb(l, c, h).join(',')})`;
}

getMakeColor()
  .then(makeColor => {
    const colors = [];

    for (let i = 0; i < nColors; i++) {
      colors.push(makeColor(lightness, chroma, (hue + 360 * i / nColors) % 360));
    }

    drawPatch({ x: 0, y: 0, width, height, depth: 0, colors });
  });
