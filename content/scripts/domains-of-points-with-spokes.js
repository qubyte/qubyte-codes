import createContainedSvg from './create-contained-svg.js';
import createSvgElement from './create-svg-element.js';
import mulberry32 from './mulberry32.js';
import getSeed from './get-seed.js';

const SEED = getSeed();
const random = mulberry32(SEED);

console.log('SEED:', SEED);

const width = 600;
const height = 600;

const { container, svg } = createContainedSvg({ className: 'experiment', width, height });

document.querySelector('.e-content').appendChild(container);

const nPoints = 10;
const nSpokes = 48;
const gap = 5; // Leave a gap between things.

// The half way line between two points is refered to as a tangent here, since
// it is defined as a line half way between two points and perpendicular to the
// line between the two points. This function calculates the length of a spoke
// from a point ([x0, y0]) to the tangent line with another point.
//
// The spoke is defined by a point and an angle or radiation, but since sine and
// cosine of this angle are used elsewhere this function takes precomputed
// values.
function calculateLengthToTangent([x0, y0], [x1, y1], sin, cos) {
  const dy = y1 - y0;
  const dx = x1 - x0;

  return 0.5 * (dx * dx + dy * dy) / (dy * sin + dx * cos);
}

function calculateSpokes(points, nSpokes, xmax, ymax) {
  const spokes = [];

  for (const p0 of points) {
    const [x, y] = p0;
    const otherPoints = points.filter(p => p !== p0).map(p1 => {
      // Make the point appear closer to avoid a bunch of awkward maths.
      const dx = p1[0] - x;
      const dy = p1[1] - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const factor = (d - gap) / d;

      return [x + dx * factor, y + dy * factor];
    });

    for (let spoke = 0; spoke < nSpokes; spoke++) {
      const angle = spoke * 2 * Math.PI / nSpokes;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // The length of the spoke from a point before it reaches a boundary.
      const lengths = [
        // Lengths to canvas boundaries minus the gap.
        (gap - x) / cos, (xmax - x - gap) / cos, (gap - y) / sin, (ymax - y - gap) / sin,
        // Lengths to tangents.
        ...otherPoints.map(p1 => calculateLengthToTangent(p0, p1, sin, cos))
      ];

      // Find the minimum positive length (lines radiate away from points).
      const r = Math.min(...lengths.filter(r => r >= 0));

      const x1 = x + gap * cos;
      const y1 = y + gap * sin;
      const x2 = x + r * cos;
      const y2 = y + r * sin;

      // These were a mistake, but look cool so I'm keeping them.
      // const x2 = x + r -gap * cos;
      // const y2 = y + r -gap * sin;

      spokes.push([[x1, y1], [x2, y2]]);
    }
  }

  return spokes;
}

// Initialize points at least 2*gap from boundaries to avoid some glitching.
function generatePoints(n, xmax, ymax) {
  return Array.from({ length: n }, () => [
    gap * 2 + random() * (xmax - 4 * gap),
    gap * 2 + random() * (ymax - 4 * gap)
  ]);
}

function drawToSvg() {
  const points = generatePoints(nPoints, width, height);
  const spokes = calculateSpokes(points, nSpokes, width, height);

  // Draw points.
  // for (const [cx, cy] of points) {
  //   const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  //   setAttributesNS(circle, { cx, cy, r: 2 });
  //   svg.appendChild(circle);
  // }

  // Draw spokes.
  for (const [[x1, y1], [x2, y2]] of spokes) {
    svg.appendChild(createSvgElement('line', { x1, y1, x2, y2 }));
  }
}

drawToSvg();
