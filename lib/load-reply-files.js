import { readdir, readFile } from 'node:fs/promises';
import handlebars from 'handlebars';
import getTimezone from './get-timezone.js';

const makeSnippet = handlebars.compile('<p>{{content}}</p>');
const makeFeedItem = handlebars.compile('<p>{{content}}</p>');

export default async function loadReplyFiles(dir) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const note = await readFile(new URL(filename, dir), 'utf8');
    const { properties: { content: [content], 'in-reply-to': [inReplyTo], latitude, longitude } } = JSON.parse(note);
    const timestamp = parseInt(filename, 10);

    return {
      language: 'en',
      timestamp,
      localUrl: `/replies/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      timezone: getTimezone(latitude, longitude),
      content,
      inReplyTo,
      title: `Reply to ${inReplyTo}`,
      snippet: makeSnippet({ content }),
      feedItem: makeFeedItem({ content }),
      type: 'reply',
      filename: `${timestamp}.html`
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
