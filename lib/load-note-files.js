import { readdir, readFile } from 'node:fs/promises';
import handlebars from 'handlebars';
import getTimezone from './get-timezone.js';

const makeSnippet = handlebars.compile('<p class="p-summary">{{content}}</p>');
const makeFeedItem = handlebars.compile('<p>{{content}}</p>');

export default async function loadNoteFiles(dir, syndications, imagesDimensions) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const note = JSON.parse(await readFile(new URL(filename, dir), 'utf8'));
    const { type: [hType], properties: { photo, 'mp-syndicate-to': rawSyndications, latitude, longitude } } = note;
    const timestamp = parseInt(filename, 10);
    const filteredSyndications = [].concat(rawSyndications).filter(Boolean);

    const common = {
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
      type: 'note'
    };

    // Study sessions.
    if (hType === 'h-event') {
      const duration = parseInt(note.properties.duration, 10);
      const [content] = note.properties.name;
      const categories = note.properties.category;

      return {
        ...common,
        datetime: new Date(timestamp - 60000 * duration).toISOString(),
        duration,
        title: `Study session ${index}`,
        content,
        categories,
        snippet: makeSnippet({ content }),
        feedItem: makeFeedItem({ content })
      };
    }

    const [content] = note.properties.content;
    const photos = (photo || []).map(p => typeof p === 'string' ? { value: p, alt: content } : p);

    for (const photo of photos) {
      const { width, height } = imagesDimensions.get(photo.value);
      photo.width = width;
      photo.height = height;
    }

    return {
      ...common,
      datetime: new Date(timestamp).toISOString(),
      content,
      photos,
      title: `Note ${index}`,
      snippet: makeSnippet({ content }),
      feedItem: makeFeedItem({ content })
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
