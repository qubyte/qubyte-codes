import { constants } from 'fs';
import { readdir, readFile, access } from 'node:fs/promises';
import handlebars from 'handlebars';
import getTimezone from './get-timezone.js';

const makeSnippet = handlebars.compile('<p class="p-summary">{{content}}</p>');
const makeFeedItem = handlebars.compile('<p>{{content}}</p>');

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

    const [content] = note.properties.content;
    const photos = await Promise.all((photo || []).map(async p => {
      const photo = typeof p === 'string' ? { value: p, alt: content } : { ...p };
      const name = photo.value.match(/\/(?<name>\d+)\./)?.groups.name;

      await Promise.all([
        fileReadable(new URL(`${name}.avif`, imagesDir)).then(exists => {
          if (exists) {
            photo.avif = `/images/${name}.avif`;
          }
        }),
        fileReadable(new URL(`${name}.webp`, imagesDir)).then(exists => {
          if (exists) {
            photo.webp = `/images/${name}.webp`;
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
      snippet: makeSnippet({ content }),
      feedItem: makeFeedItem({ content })
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
