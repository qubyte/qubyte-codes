import { promises as fs } from 'fs';
import handlebars from 'handlebars';

const makeSnippet = handlebars.compile('<p>{{content}}</p>');

export default async function loadReplyFiles(dir) {
  const filenames = await fs.readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const note = await fs.readFile(new URL(filename, dir), 'utf8');
    const { properties: { content: [content], 'in-reply-to': [inReplyTo] } } = JSON.parse(note);
    const timestamp = parseInt(filename, 10);

    return {
      timestamp,
      localUrl: `/replies/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      content,
      inReplyTo,
      title: `Reply to ${inReplyTo}`,
      snippet: makeSnippet({ content }),
      type: 'reply',
      filename: `${timestamp}.html`
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
