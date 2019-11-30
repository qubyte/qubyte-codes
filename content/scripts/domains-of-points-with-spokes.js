const container = document.createElement('div');
container.className = 'experiment';

function setAttributesNS(element, attributes) {
  for (const [key, val] of Object.entries(attributes)) {
    element.setAttributeNS(null, key, val);
  }

  return element;
}

const svg = setAttributesNS(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), {
  width: '600',
  height: '600',
  viewBox: '0 0 600 600'
});

container.appendChild(svg);

document.querySelector('.e-content').appendChild(container);

const nPoints = 10;
const nSpokes = 48;

// The half way line between two points is refered to as a tangent here, since
// it is defined as a line half way between two points and perpendicular to the
// line between the two points. This function calculates the length of a spoke
// from a point ([x0, y0]) to the tangent line with another point.
//
// The spoke is defined by a point and an angle or radiation, but since sine and
// cosine of this angle are used elsewhere this function takes precomputed
// values.
function calculateLengthToTangent([x0, y0], [x1, y1], sin, cos) {
  const slope = (x1 - x0) / (y0 - y1);

  return 0.5 * (y1 - y0 + slope * (x0 - x1)) / (sin - slope * cos);
}

function calculateSpokes(points, nSpokes, xmax, ymax) {
  const spokes = [];

  for (const p0 of points) {
    const [x, y] = p0;
    const otherPoints = points.filter(p => p !== p0);

    for (let spoke = 0; spoke < nSpokes; spoke++) {
      const angle = spoke * 2 * Math.PI / nSpokes;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // The length of the spoke from a point before it reaches a boundary.
      const lengths = [
        // Lengths to canvas boundaries.
        -x / cos, (xmax - x) / cos, -y / sin, (ymax - y) / sin,
        // Lengths to tangents.
        ...otherPoints.map(p1 => calculateLengthToTangent(p0, p1, sin, cos))
      ];

      // Find the minimum positive length (lines radiate away from points).
      const r = Math.min(...lengths.filter(r => r >= 0));

      // Leave a gap between things.
      const gap = 5;

      const x1 = x + gap * cos;
      const y1 = y + gap * sin;
      const x2 = x + (r - gap) * cos;
      const y2 = y + (r - gap) * sin;

      spokes.push([[x1, y1], [x2, y2]]);
    }
  }

  return spokes;
}

function generatePoints(n, xmax, ymax) {
  return Array.from({ length: n }, () => [Math.random() * xmax, Math.random() * ymax]);
}

function drawToSvg() {
  const points = generatePoints(nPoints, svg.clientWidth, svg.clientHeight);
  const spokes = calculateSpokes(points, nSpokes, svg.clientWidth, svg.clientHeight);

  // Draw points.
  // for (const [cx, cy] of points) {
  //   const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  //   setAttributesNS(circle, { cx, cy, r: 2 });
  //   svg.appendChild(circle);
  // }

  // Draw spokes.
  for (const [[x1, y1], [x2, y2]] of spokes) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    setAttributesNS(line, { x1, y1, x2, y2 });
    svg.appendChild(line);
  }
}

drawToSvg();
