import pick from '../content/scripts/pick.js';
import mulberry32 from '../content/scripts/mulberry32.js';
import lch2rgb from '../content/scripts/lch2rgb.js';
import sharp from 'sharp';

const width = 256;
const height = 256;

function drawRect({ x: x0, y: y0, width: cellWidth, height: cellHeight, imageWidth, fill, pixelData }) {
  // Box starting at (x, y) and ending at (x + width, y + height))
  const xMax = x0 + cellWidth;
  const yMax = y0 + cellHeight;

  for (let y = y0; y < yMax; y++) {
    for (let x = x0; x < xMax; x++) {
      const point = (x + y * imageWidth) * 3;

      pixelData[point] = fill[0];
      pixelData[point + 1] = fill[1];
      pixelData[point + 2] = fill[2];
    }
  }
}

function drawPatch({ x: x0, y: y0, width, height, depth, colors, imageWidth, random, pixelData }) {
  // Each patch is split into quadrants.
  const rows = 2;
  const cols = 2;
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  for (let i = 0; i < cols; i++) {
    const x = x0 + i * cellWidth;

    for (let j = 0; j < rows; j++) {
      const y = y0 + j * cellHeight;

      if (depth > 6 || random() < 0.5) {
        drawRect({ x, y, width: cellWidth, height: cellHeight, fill: pick(colors, random), imageWidth, pixelData });
      } else {
        drawPatch({ x, y, width: cellWidth, height: cellHeight, depth: depth + 1, colors, imageWidth, random, pixelData });
      }
    }
  }
}

function modulo(n, m) {
  return n < 1 ? m + n % m : n % m;
}

function makeColor(l, c, h) {
  const [r, g, b] = lch2rgb(l, c, h);
  return [modulo(r, 255), modulo(g, 255), modulo(b, 255)];
}

/** @param {Number} seed */
export function createSocialImage(seed) {
  const random = mulberry32(seed);
  const hue = Math.round(random() * 360);
  const chroma = 60 + 75 * random();
  const lightness = 100;
  const nColors = 1 + random() * 5;
  const colors = [];
  const pixelData = new Uint8Array(width * height * 3);

  for (let i = 0; i < nColors; i++) {
    colors.push(makeColor(lightness, chroma, (hue + 360 * i / nColors) % 360));
  }

  drawPatch({ x: 0, y: 0, width, height, depth: 0, colors, imageWidth: width, random, pixelData });

  return sharp(pixelData, { raw: { width, height, channels: 3, premultiplied: true } })
    .png()
    .toFile(`public/images/social-${seed}.png`);
}

