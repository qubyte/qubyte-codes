import sharp from 'sharp';
import { upload } from './upload.js';

export async function uploadImage(photo) {
  console.log('Converting image...', photo);

  const time = Date.now();
  const s = sharp(photo.content).rotate();

  function convertTo(width, format) {
    return s.clone()
      .resize(width)
      .toFormat(format)
      .toBuffer();
  }

  const [jpeg, avif2x, avif, webp2x, webp] = await Promise.all([
    convertTo(800, 'jpeg'),
    convertTo(1600, 'avif'),
    convertTo(800, 'avif'),
    convertTo(1600, 'webp'),
    convertTo(800, 'webp')
  ]);

  // I can't do these concurrently without upsetting GitHub.
  await upload('New photo (jpeg).\n\n[skip ci]', 'images', `${time}.jpeg`, jpeg);
  await upload('New photo (avif 2x).\n\n[skip ci]', 'images', `${time}-2x.avif`, avif2x);
  await upload('New photo (avif).\n\n[skip ci]', 'images', `${time}.avif`, avif);
  await upload('New photo (webp 2x).\n\n[skip ci]', 'images', `${time}-2x.webp`, webp2x);
  await upload('New photo (webp).\n\n[skip ci]', 'images', `${time}.webp`, webp);

  return `/images/${time}.jpeg`;
}
