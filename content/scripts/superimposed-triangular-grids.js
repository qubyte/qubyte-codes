import createContainedSvg from './create-contained-svg.js';
import createSvgElement from './create-svg-element.js';

const width = 500;
const height = 500;

const { container, svg } = createContainedSvg({ className: 'experiment', width, height });

document.querySelector('.e-content').appendChild(container);

const nLines = 100; // Number of lines in each direction.

function drawTriangularGroup(angle) {
  const diagonalWidth = Math.sqrt(width * width + height * height);
  const gapSize = diagonalWidth / (nLines - 1);

  const group = createSvgElement('g', {
    transform: `translate(${width / 2} ${height / 2}) rotate(${angle})`
  });

  for (let a = 0; a < 360; a += 120) {
    const subGroup = createSvgElement('g', {
      transform: `rotate(${a})`
    });

    const y1 = -diagonalWidth / 2;
    const y2 = diagonalWidth / 2;

    for (let i = 0; i < nLines; i++) {
      const x = i * gapSize - diagonalWidth / 2;

      subGroup.appendChild(createSvgElement('line', { x1: x, x2: x, y1, y2 }));
    }

    group.appendChild(subGroup);
  }

  return group;
}

function drawToSvg() {
  svg.appendChild(drawTriangularGroup(0));
  svg.appendChild(drawTriangularGroup(5));
}

drawToSvg();
