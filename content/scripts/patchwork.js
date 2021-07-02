import createContainedSvg from './create-contained-svg.js';
import createSvgElement from './create-svg-element.js';

const width = 600;
const height = 600;

const { container, svg } = createContainedSvg({ className: 'experiment', width, height, 'shape-rendering': 'crispEdges' });

document.querySelector('.e-content').appendChild(container);

function drawRect({ x, y, width, height, fill }) {
  svg.appendChild(createSvgElement('rect', { x, y, width, height, 'stroke-width': 0, fill }));
}

function draw({ x, y, width, height }) {
  const fill = ['red', 'green', 'blue'][Math.floor(Math.random() * 3)];
  drawRect({ x, y, width, height, fill });
}

function drawPatch({ x: x0, y: y0, width, height, depth }) {
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
        draw({ x, y, width: cellWidth, height: cellHeight });
      } else {
        drawPatch({ x, y, width: cellWidth, height: cellHeight, depth: depth + 1 });
      }
    }
  }
}

drawPatch({ x: 0, y: 0, width, height, depth: 0 });
