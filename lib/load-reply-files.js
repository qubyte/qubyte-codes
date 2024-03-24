// @ts-check

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
   * @param {Date} options.date
   * @param {string} options.timezone
   * @param {string} options.inReplyTo
   */
  constructor({
    baseUrl,
    content,
    date,
    timezone,
    inReplyTo
  }) {
    const timestamp = date.getTime();

    super({
      baseUrl,
      localUrl: `/replies/${timestamp}`,
      content,
      filename: `${timestamp}.html`
    });

    this.timestamp = timestamp;
    this.timezone = timezone;
    this.type = 'reply';
    this.datetime = date.toISOString();
    this.title = `Reply to ${inReplyTo}`;
    this.inReplyTo = inReplyTo;
    this.snippet = makeSnippet({ content });
    this.feedItem = makeFeedItem({ content });
  }
}

export default async function loadReplyFiles({ baseUrl, dir }) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const note = JSON.parse(await readFile(new URL(filename, dir), 'utf8'));
    const timezone = getTimezone(note.location?.latitude, note.location?.longitude);

    return new ReplyPage({
      baseUrl,
      content: note.content,
      date: new Date(note.published),
      timezone,
      inReplyTo: note['in-reply-to']
    });
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
