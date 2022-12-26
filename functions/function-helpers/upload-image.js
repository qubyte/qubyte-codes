import sharp from 'sharp';
import { upload } from './upload.js';
import PQueue from 'p-queue';

export async function uploadImage(photo) {
  console.log(new Date().toISOString(), 'Converting image...', photo);

  // GitHub gets upset with concurrent use of the content API.
  const queue = new PQueue({ concurrency: 1 });
  const time = Date.now();
  const s = sharp(photo.content, { sequentialRead: true }).rotate();

  function convertTo(width, format, name) {
    s.clone()
      .resize(width)
      .toFormat(format, { effort: 3 })
      .toBuffer()
      .then(buffer => queue.add(() => upload(`New photo (${name}).\n\n[skip ci]`, 'images', name, buffer)));
  }

  await Promise.all([
    convertTo(800, 'jpeg', `${time}.jpeg`),
    convertTo(1600, 'avif', `${time}-2x.avif`),
    convertTo(800, 'avif', `${time}.avif`)
  ]);

  return `/images/${time}.jpeg`;
}
