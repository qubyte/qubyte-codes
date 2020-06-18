const container = document.createElement('div');
container.className = 'experiment';

function setAttributesNS(element, attributes) {
  for (const [key, val] of Object.entries(attributes)) {
    element.setAttributeNS(null, key, val);
  }

  return element;
}

const width = 500;
const height = 500;

const svg = setAttributesNS(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
  viewBox: `0 0 ${width} ${height}`
});

container.appendChild(svg);

document.querySelector('.e-content').appendChild(container);

const nPoints = 50;

function calculateCircles(points/*, xmax, ymax*/) {
  const circles = [];

  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const distances = points.slice(i + 1)
      .map(([x1, y1]) => Math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2))
      .concat(circles.map(({ cx, cy, r }) => Math.sqrt((x0 - cx) ** 2 + (y0 - cy) ** 2) - r));
      // .concat([ x0, xmax, y0, ymax ]); // distance to boundaries

    const r = Math.min(...distances);
    const strokeWidth = Math.floor(Math.random() * 5) + 1;

    if (r > 0) {
      circles.push({ cx: x0, cy: y0, r, strokeWidth });
    }
  }

  return circles;
}

function drawCircle({ cx, cy, r, strokeWidth }) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  setAttributesNS(circle, { cx, cy, r, 'stroke-width': strokeWidth, fill: 'none' });
  svg.appendChild(circle);
}

function generatePoints(n, xmax, ymax) {
  return Array.from({ length: n }, () => [Math.random() * xmax, Math.random() * ymax]);
}

function drawToSvg() {
  const points = generatePoints(nPoints, width, height);
  const circles = calculateCircles(points, width, height);

  circles.forEach(drawCircle);
}

drawToSvg();
