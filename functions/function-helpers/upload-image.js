import { upload } from './upload.js';

export async function uploadImage(photo) {
  console.log('Pushing image...', photo);

  const time = Date.now();
  const type = (photo.type || '').toLowerCase().split(';')[0].trim();
  const suffix = type.startsWith('image/') ? type.slice(6) : '';

  if (!suffix) {
    console.warn('Unknown file type. Not sending to GitHub:', photo.type);
    return '';
  }

  // A GitHub Actions workflow watches for changes to content/images/*-original.jpeg
  const name = suffix.match(/jpg|jpeg/) ? `${time}-original.jpeg` : `${time}.${suffix}`;

  await upload(`New photo (${name}).\n\n[skip netlify]`, 'images', name, photo.content);

  return `/images/${time}.${suffix}`;
}
