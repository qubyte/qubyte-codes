import { promises as fs } from 'fs';
import path from 'path';
import handlebars from 'handlebars';

const makeSnippet = handlebars
  .compile('<p class="p-summary">Like of <a href="{{likeOf}}">{{likeOf}}</a></p>');

export default async function loadLikeFiles(dir) {
  const filenames = await fs.readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const note = await fs.readFile(path.join(dir, filename), 'utf8');
    const { properties: { 'like-of': [likeOf] } } = JSON.parse(note);
    const timestamp = parseInt(filename, 10);

    return {
      timestamp,
      localUrl: `/likes/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      likeOf,
      title: `Like of ${likeOf}`,
      type: 'like',
      filename: `${timestamp}.html`,
      snippet: makeSnippet({ likeOf })
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
