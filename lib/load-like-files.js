import fs from 'node:fs/promises';
import handlebars from 'handlebars';

const makeSnippet = handlebars
  .compile('<p class="p-summary">Like of <a href="{{likeOf}}">{{likeOf}}</a></p>');

const makeFeedItem = handlebars
  .compile('<p>Like of <a href="{{likeOf}}">{{likeOf}}</a></p>');


export default async function loadLikeFiles(dir) {
  const filenames = await fs.readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const note = await fs.readFile(new URL(filename, dir), 'utf8');
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
      snippet: makeSnippet({ likeOf }),
      feedItem: makeFeedItem({ likeOf })
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
