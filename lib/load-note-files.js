import { constants } from 'fs';
import { readdir, readFile, access } from 'node:fs/promises';
import render from './render.js';
import getTimezone from './get-timezone.js';
import Page from './page.js';

async function fileReadable(url) {
  try {
    await access(url, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

class NotePage extends Page {
  /**
   * @param {object} options
   * @param {string|URL} options.baseUrl
   * @param {string} options.content
   * @param {string} options.hType
   * @param {number} options.timestamp
   * @param {string} options.timezone
   * @param {string} options.spoiler
   * @param {any[]} options.photos,
   * @param {string} options.title
   */
  constructor({
    baseUrl,
    content,
    hType,
    timestamp,
    timezone,
    spoiler,
    photos,
    title
  }) {
    super({
      baseUrl,
      localUrl: `/notes/${timestamp}`,
      content,
      filename: `${timestamp}.html`
    });
    this.hType = hType;
    this.timestamp = timestamp;
    this.timezone = timezone;
    this.datetime = new Date(timestamp).toISOString();
    this.type = 'note';
    this.spoiler = spoiler;
    this.photos = photos;
    this.image = photos.length ? photos[0] : null;
    this.title = title;
    this.feedItem = content;
  }
}

export default async function loadNoteFiles({ baseUrl, dir, imagesDir, imagesDimensions }) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const note = JSON.parse(await readFile(new URL(filename, dir), 'utf8'));
    const { type: [hType], properties: { photo, latitude, longitude } } = note;
    const timestamp = parseInt(filename, 10);

    const [body] = note.properties.content;
    const [spoiler] = note.properties.spoiler || [];
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

    return new NotePage({
      baseUrl,
      content,
      hType,
      timestamp,
      timezone: getTimezone(latitude, longitude),
      spoiler,
      photos,
      title: `Note ${index}`
    });
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
