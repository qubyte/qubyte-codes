import sharp from 'sharp';
import { upload } from './upload.js';

export async function uploadImage(photo) {
  console.log(new Date().toISOString(), 'Converting image...', photo);

  const time = Date.now();
  const s = sharp(photo.content, { sequentialRead: true }).rotate();

  function convertTo(width, format) {
    return s.clone()
      .resize(width)
      .toFormat(format)
      .toBuffer();
  }

  const [jpeg, avif2x, avif] = await Promise.all([
    convertTo(800, 'jpeg'),
    convertTo(1600, 'avif'),
    convertTo(800, 'avif')
  ]);

  // I can't do these concurrently without upsetting GitHub.
  await upload('New photo (jpeg).\n\n[skip ci]', 'images', `${time}.jpeg`, jpeg);
  await upload('New photo (avif 2x).\n\n[skip ci]', 'images', `${time}-2x.avif`, avif2x);
  await upload('New photo (avif).\n\n[skip ci]', 'images', `${time}.avif`, avif);

  return `/images/${time}.jpeg`;
}
