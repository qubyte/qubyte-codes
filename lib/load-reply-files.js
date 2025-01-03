// @ts-check

import { readdir, readFile } from 'node:fs/promises';
import render from './render.js';
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
  const replies = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const reply = JSON.parse(await readFile(new URL(filename, dir), 'utf8'));
    const { content } = render(reply.content);
    const timezone = getTimezone(reply.location?.latitude, reply.location?.longitude);

    return new ReplyPage({
      baseUrl,
      content,
      date: new Date(reply.published),
      timezone,
      inReplyTo: reply['in-reply-to']
    });
  }));

  replies.sort((a, b) => b.timestamp - a.timestamp);

  return replies;
}
