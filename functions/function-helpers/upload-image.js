import sharp from 'sharp';
import { upload } from './upload.js';

export async function uploadImage(photo) {
  console.log('Converting image...', photo);

  const time = Date.now();
  const jpeg = await sharp(photo.content)
    .rotate()
    .resize(800)
    .jpeg()
    .toBuffer();
  await upload('New photo (jpeg).\n\n[skip ci]', 'images', `${time}.jpeg`, jpeg);

  const avif2x = await sharp(photo.content)
    .rotate()
    .resize(1600)
    .avif()
    .toBuffer();
  await upload('New photo (avif).\n\n[skip ci]', 'images', `${time}-2x.avif`, avif2x);

  const avif = await sharp(photo.content)
    .rotate()
    .resize(800)
    .avif()
    .toBuffer();
  await upload('New photo (avif).\n\n[skip ci]', 'images', `${time}.avif`, avif);

  const webp2x = await sharp(photo.content)
    .rotate()
    .resize(1600)
    .webp()
    .toBuffer();
  await upload('New photo (webp).\n\n[skip ci]', 'images', `${time}-2x.webp`, webp2x);

  const webp = await sharp(photo.content)
    .rotate()
    .resize(800)
    .webp()
    .toBuffer();
  await upload('New photo (webp).\n\n[skip ci]', 'images', `${time}.webp`, webp);

  return `/images/${time}.jpeg`;
}
