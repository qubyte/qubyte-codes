import fs from 'node:fs/promises';
import handlebars from 'handlebars';
import getTimezone from './get-timezone.js';

const makeSnippet = handlebars.compile('<p class="p-summary">{{content}}</p>');
const makeFeedItem = handlebars.compile('<p>{{content}}</p>');

export default async function loadNoteFiles(dir, syndications, imagesDimensions) {
  const filenames = await fs.readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const note = await fs.readFile(new URL(filename, dir), 'utf8');
    const { properties: { content: [content], photo, 'mp-syndicate-to': rawSyndications, latitude, longitude } } = JSON.parse(note);
    const timestamp = parseInt(filename, 10);
    const filteredSyndications = [].concat(rawSyndications).filter(Boolean);

    const photos = (photo || []).map(p => typeof p === 'string' ? { value: p, alt: content } : p);

    for (const photo of photos) {
      const { width, height } = imagesDimensions.get(photo.value);
      photo.width = width;
      photo.height = height;
    }

    return {
      timestamp,
      localUrl: `/notes/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      timezone: getTimezone(latitude, longitude),
      content,
      photos,
      title: `Note ${index}`,
      snippet: makeSnippet({ content }),
      feedItem: makeFeedItem({ content }),
      syndications: {
        twitter: filteredSyndications.includes(syndications.twitter),
        mastodon: filteredSyndications.includes(syndications.mastodon)
      },
      type: 'note',
      filename: `${timestamp}.html`
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
