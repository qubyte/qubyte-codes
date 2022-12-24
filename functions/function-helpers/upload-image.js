import sharp from 'sharp';
import { upload } from './upload.js';

async function convertTo(sharp, format, width, name) {
  const converted = await sharp
    .resize(width)
    .toFormat(format)
    .toBuffer();

  await upload(`New photo (${format}).\n\n[skip ci]`, 'images', name, converted);
}

export async function uploadImage(photo) {
  console.log('Converting image...', photo);

  const time = Date.now();
  const s = sharp(photo.content).rotate();

  await Promise.all([
    convertTo(s.clone(), 'jpeg', 800, `${time}.jpeg`),
    convertTo(s.clone(), 'avif', 1600, `${time}-2x.avif`),
    convertTo(s.clone(), 'avif', 800, `${time}.avif`),
    convertTo(s.clone(), 'webp', 1600, `${time}-2x.webp`),
    convertTo(s.clone(), 'webp', 800, `${time}.webp`)
  ]);

  return `/images/${time}.jpeg`;
}
