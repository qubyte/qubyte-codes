import createContainedSvg from './create-contained-svg.js';
import createSvgElement from './create-svg-element.js';

const width = 500;
const height = 500;

const { container, svg } = createContainedSvg({ className: 'experiment', width, height });

document.querySelector('.e-content').appendChild(container);

const nLines = 100; // Number of lines in each direction.

function drawHexagonalGroup(angle, className) {
  const diagonalWidth = Math.sqrt(width * width + height * height);
  const gapSize = diagonalWidth / (nLines - 1);

  const group = createSvgElement('g', {
    transform: `translate(${width / 2} ${height / 2}) rotate(${angle})`,
    className
  });

  group.classList.add(className);

  for (let i = 0; i < nLines; i++) {
    const x = i * gapSize - diagonalWidth / 2;
    const h = Math.sqrt((gapSize * gapSize) / 3);

    // This is very crude, but gets the job done.
    for (let y = -diagonalWidth / 2; y < diagonalWidth / 2; y += 3 * h) {
      group.appendChild(createSvgElement('path', {
        d: `M ${x} ${y} v ${h} l${-gapSize / 2} ${h / 2}  v ${h} l ${gapSize / 2} ${h / 2}`
      }));
      group.appendChild(createSvgElement('path', { d: `M ${x} ${y + h} l ${gapSize / 2} ${h / 2}` }));
      group.appendChild(createSvgElement('path', { d: `M ${x} ${y + 3 * h} l ${gapSize / 2} ${-h / 2}` }));
    }
  }

  return group;
}

function drawToSvg() {
  svg.appendChild(drawHexagonalGroup(0, 'red'));
  svg.appendChild(drawHexagonalGroup(2, 'blue'));
}

drawToSvg();
