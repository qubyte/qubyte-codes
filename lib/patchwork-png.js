import { createCanvas } from 'canvas';
import lch2rgb from '../content/scripts/lch2rgb.js';
import pick from '../content/scripts/pick.js';
import mulberry32 from '../content/scripts/mulberry32.js';

function drawPatch({ random, ctx, x: x0, y: y0, width, height, depth, colors }) {
  // Each patch is split into quadrants.
  const rows = 2;
  const cols = 2;
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  for (let i = 0; i < cols; i++) {
    const x = x0 + i * cellWidth;

    for (let j = 0; j < rows; j++) {
      const y = y0 + j * cellHeight;

      if (depth > 5 || random() < 0.5) {
        ctx.fillStyle = pick(colors, random);
        ctx.fillRect(x, y, cellWidth, cellHeight);
      } else {
        drawPatch({ random, ctx, x, y, width: cellWidth, height: cellHeight, depth: depth + 1, colors });
      }
    }
  }
}

function makeColor() {
  return (l, c, h) => `rgb(${lch2rgb(l, c, h).join(',')})`;
}

export default function makePngDataUrl(seed = Math.random()) {
  const colors = [];
  const random = mulberry32(seed);
  const hue = Math.round(random() * 360);
  const chroma = 60 + 75 * random();
  const lightness = 100;
  const nColors = 1 + random() * 5;
  const width = 300;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < nColors; i++) {
    colors.push(makeColor(lightness, chroma, (hue + 360 * i / nColors) % 360));
  }

  drawPatch({ random, ctx, x: 0, y: 0, width, height, depth: 0, colors });

  return canvas.toDataURL();
}
