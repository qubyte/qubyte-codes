import { readdir, readFile } from 'node:fs/promises';
import handlebars from 'handlebars';
import getTimezone from './get-timezone.js';
import Page from './page.js';

const makeSnippet = handlebars.compile('<p>{{content}}</p>');
const makeFeedItem = handlebars.compile('<p>{{content}}</p>');

class ReplyPage extends Page {
  /**
   * @param {object} options
   * @param {string|URL} options.baseUrl
   * @param {string} options.content
   * @param {number} options.timestamp
   * @param {string} options.timezone
   * @param {string} options.inReplyTo
   */
  constructor({
    baseUrl,
    content,
    timestamp,
    timezone,
    inReplyTo
  }) {
    super({
      baseUrl,
      localUrl: `/replies/${timestamp}`,
      content,
      filename: `${timestamp}.html`
    });

    this.timestamp = timestamp;
    this.timezone = timezone;
    this.type = 'reply';
    this.datetime = new Date(timestamp).toISOString();
    this.title = `Reply to ${inReplyTo}`;
    this.inReplyTo = inReplyTo;
    this.snippet = makeSnippet({ content });
    this.feedItem = makeFeedItem({ content });
  }
}

export default async function loadReplyFiles({ baseUrl, dir }) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const note = await readFile(new URL(filename, dir), 'utf8');
    const { properties: { content: [content], 'in-reply-to': [inReplyTo], latitude, longitude } } = JSON.parse(note);
    const timestamp = parseInt(filename, 10);
    const timezone = getTimezone(latitude, longitude);

    return new ReplyPage({ baseUrl, content, timestamp, timezone, inReplyTo });
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
