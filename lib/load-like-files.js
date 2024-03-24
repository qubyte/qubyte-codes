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
   * @param {string} options.datetime
   * @param {any} options.likeOf
   * @param {string} options.timezone
   */
  constructor({ baseUrl, datetime, likeOf, timezone }) {
    const timestamp = Date.parse(datetime);

    super({
      baseUrl,
      localUrl: `/likes/${timestamp}`,
      content: likeOf,
      filename: `${timestamp}.html`
    });

    this.timestamp = timestamp;
    this.likeOf = likeOf;
    this.datetime = datetime;
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
  const likes = await Promise.all(filenames.filter(fn => fn.endsWith('.jf2.json')).map(async filename => {
    const like = JSON.parse(await readFile(new URL(filename, dir), 'utf8'));

    return new LikePage({
      baseUrl,
      datetime: like.published,
      likeOf: like['like-of'],
      timezone: getTimezone(like.location?.latitude, like.location?.longitude)
    });
  }));

  likes.sort((a, b) => b.timestamp - a.timestamp);

  return likes;
}
