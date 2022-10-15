import { constants } from 'fs';
import { readdir, readFile, access } from 'node:fs/promises';
import render from './render.js';
import getTimezone from './get-timezone.js';

async function fileReadable(url) {
  try {
    await access(url, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export default async function loadNoteFiles(dir, imagesDir, syndications, imagesDimensions) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const note = JSON.parse(await readFile(new URL(filename, dir), 'utf8'));
    const { type: [hType], properties: { photo, 'mp-syndicate-to': rawSyndications, latitude, longitude } } = note;
    const timestamp = parseInt(filename, 10);
    const filteredSyndications = [].concat(rawSyndications).filter(Boolean);

    const [body] = note.properties.content;
    const content = render(body);
    const photos = await Promise.all((photo || []).map(async p => {
      const photo = typeof p === 'string' ? { value: p, alt: body } : { ...p };
      const name = photo.value.match(/\/(?<name>\d+)\./)?.groups.name;

      await Promise.all([
        fileReadable(new URL(`${name}.avif`, imagesDir)).then(exists => {
          if (exists) {
            photo.avif = `/images/${name}.avif`;
          }
        }),
        fileReadable(new URL(`${name}-2x.avif`, imagesDir)).then(exists => {
          if (exists) {
            photo.avif2x = `/images/${name}-2x.avif`;
          }
        }),
        fileReadable(new URL(`${name}.webp`, imagesDir)).then(exists => {
          if (exists) {
            photo.webp = `/images/${name}.webp`;
          }
        }),
        fileReadable(new URL(`${name}-2x.webp`, imagesDir)).then(exists => {
          if (exists) {
            photo.webp2x = `/images/${name}-2x.webp`;
          }
        })
      ]);

      Object.assign(photo, imagesDimensions.get(photo.value));

      return photo;
    }));

    return {
      hType,
      timestamp,
      localUrl: `/notes/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      timezone: getTimezone(latitude, longitude),
      syndications: {
        twitter: filteredSyndications.includes(syndications.twitter),
        mastodon: filteredSyndications.includes(syndications.mastodon)
      },
      filename: `${timestamp}.html`,
      type: 'note',
      content,
      photos,
      image: photos.length ? photos[0] : null,
      title: `Note ${index}`,
      feedItem: content
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
