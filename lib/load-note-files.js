import { readdir, readFile } from 'node:fs/promises';
import render from './render.js';
import getTimezone from './get-timezone.js';
import Page from './page.js';
import composePicture from './compose-picture.js';

class NotePage extends Page {
  /**
   * @param {object} options
   * @param {string|URL} options.baseUrl
   * @param {string} options.content
   * @param {string} options.hType
   * @param {Date} options.date
   * @param {string} options.timezone
   * @param {string} options.spoiler
   * @param {any[]} options.photos,
   * @param {string} options.title
   */
  constructor({
    baseUrl,
    content,
    hType,
    date,
    timezone,
    spoiler,
    photos,
    title
  }) {
    const timestamp = date.getTime();

    super({
      baseUrl,
      localUrl: `/notes/${timestamp}`,
      content,
      filename: `${timestamp}.html`
    });
    this.hType = hType;
    this.timestamp = timestamp;
    this.timezone = timezone;
    this.datetime = date.toISOString();
    this.type = 'note';
    this.spoiler = spoiler;
    this.photos = photos;
    this.image = photos.length ? photos[0] : null;
    this.title = title;
    this.feedItem = content;
  }
}

export default async function loadNoteFiles({ baseUrl, dir, imagesDimensions }) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const note = JSON.parse(await readFile(new URL(filename, dir), 'utf8'));
    const content = render(note.content);

    const photos = await Promise.all((note.photo ? [].concat(note.photo) : []).map(p => {
      const { value, alt } = typeof p === 'string' ? { value: p, alt: note.content } : { ...p };

      return composePicture(value, null, alt, imagesDimensions);
    }));

    return new NotePage({
      baseUrl,
      content,
      hType: `h-${note.type}`,
      date: new Date(note.published),
      timezone: getTimezone(note.location?.latitude, note.location?.longitude),
      spoiler: note.spoiler,
      photos,
      title: `Note ${index}`
    });
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
