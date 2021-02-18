import { promises as fs } from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import imageSize from 'image-size';

const makeSnippet = handlebars.compile('<p class="p-summary">{{content}}</p>');

export default async function loadNoteFiles(dir, syndications, publicDirectory) {
  const filenames = await fs.readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const note = await fs.readFile(path.join(dir, filename), 'utf8');
    const { properties: { content: [content], photo, 'mp-syndicate-to': rawSyndications } } = JSON.parse(note);
    const timestamp = parseInt(filename, 10);
    const filteredSyndications = [].concat(rawSyndications).filter(Boolean);

    const photos = (photo || []).map(p => typeof p === 'string' ? { value: p, alt: content } : p);

    await Promise.all(photos.map(async photo => {
      const { width, height } = await imageSize(path.join(publicDirectory, photo.value));
      photo.width = width;
      photo.height = height;
    }));

    return {
      timestamp,
      localUrl: `/notes/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      content,
      photos,
      title: `Note ${index}`,
      snippet: makeSnippet({ content }),
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
