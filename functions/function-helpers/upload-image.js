import sharp from 'sharp';
import { upload } from './upload.js';

export async function uploadImage(photo) {
  const time = Date.now();
  const resized = sharp(photo.content).resize(800);
  const [jpeg, avif, webp] = Promise.all([
    resized.jpeg().toBuffer(),
    resized.avif().toBuffer(),
    resized.webp().toBuffer()
  ]);
  await upload('New photo (jpeg).\n\n[skip ci]', 'images', `${time}.jpeg`, jpeg);
  await upload('New photo (avif).\n\n[skip ci]', 'images', `${time}.avif`, avif);
  await upload('New photo (webp).\n\n[skip ci]', 'images', `${time}.webp`, webp);

  return `/images/${time}.jpeg`;
}
