import { readdir, readFile } from 'node:fs/promises';
import handlebars from 'handlebars';
import getTimezone from './get-timezone.js';
import Page from './page.js';

const makeSnippet = handlebars
  .compile('<p class="p-summary">Like of <a href="{{likeOf}}">{{likeOf}}</a></p>');

const makeFeedItem = handlebars
  .compile('<p>Like of <a href="{{likeOf}}">{{likeOf}}</a></p>');

class LikePage extends Page {
  /**
   * @param {object} options
   * @param {string|URL} options.baseUrl
   * @param {number} options.timestamp
   * @param {any} options.likeOf
   * @param {string} options.timezone
   */
  constructor({ baseUrl, timestamp, likeOf, timezone }) {
    super({
      baseUrl,
      localUrl: `/likes/${timestamp}`,
      content: likeOf,
      filename: `${timestamp}.html`
    });
    this.timestamp = timestamp;
    this.likeOf = likeOf;
    this.datetime = new Date(timestamp).toISOString();
    this.type = 'like';
    this.timezone = timezone;
    this.title = `Like of ${likeOf}`;
    this.filename = `${timestamp}.html`;
    this.snippet = makeSnippet(this);
    this.feedItem = makeFeedItem(this);
  }
}

export default async function loadLikeFiles({ baseUrl, dir }) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const note = await readFile(new URL(filename, dir), 'utf8');
    const { properties: { 'like-of': [likeOf], latitude, longitude } } = JSON.parse(note);
    const timestamp = parseInt(filename, 10);

    return new LikePage({
      baseUrl,
      timestamp,
      likeOf,
      timezone: getTimezone(latitude, longitude)
    });
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
