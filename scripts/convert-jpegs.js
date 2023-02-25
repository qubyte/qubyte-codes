import sharp from 'sharp';
import { join } from 'node:path';

const paths = process.argv.slice(2);
const results = [];

function convertTo(fullPath, width, format, name) {
  return sharp(fullPath)
    .rotate()
    .resize(width)
    .toFormat(format)
    .toFile(name)
    .then(() => console.log('generated', name));
}

for (const path of paths) {
  const fullPath = join(process.cwd(), path);

  console.log('Converting:', fullPath);

  results.push(
    convertTo(fullPath, 1600, 'avif', fullPath.replace('-original.jpeg', '-2x.avif')),
    convertTo(fullPath, 800, 'avif', fullPath.replace('-original.jpeg', '.avif')),
    convertTo(fullPath, 1600, 'webp', fullPath.replace('-original.jpeg', '-2x.webp')),
    convertTo(fullPath, 800, 'webp', fullPath.replace('-original.jpeg', '.webp')),
    convertTo(fullPath, 800, 'jpeg', fullPath.replace('-original.jpeg', '.jpeg'))
  );
}

await Promise.all(results);
