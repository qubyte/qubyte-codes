import { readdir, readFile } from 'node:fs/promises';
import handlebars from 'handlebars';
import getTimezone from './get-timezone.js';
import Page from './page.js';

const makeSnippet = handlebars
  .compile('<p class="p-summary">{{#if content}}{{content}} {{/if}}<a href="{{canonical}}">{{name}}</a></p>');

const makeFeedItem = handlebars
  .compile('<p>{{#if content}}{{content}} {{/if}}<a href="{{canonical}}">{{name}}</a></p>');

class LinkPage extends Page {
  /**
   * @param {object} options
   * @param {string|URL} options.baseUrl
   * @param {string} options.content
   * @param {number} options.timestamp
   * @param {string} options.timezone
   * @param {string} options.title
   * @param {any} options.bookmarkOf
   * @param {any} options.repostOf
   * @param {string} options.name
   */
  constructor({
    baseUrl,
    content,
    timestamp,
    timezone,
    title,
    bookmarkOf,
    repostOf,
    name
  }) {
    super({
      baseUrl,
      localUrl: `/links/${timestamp}`,
      content,
      filename: `${timestamp}.html`
    });
    this.timestamp = timestamp;
    this.timezone = timezone;
    this.datetime = new Date(timestamp).toISOString();
    this.type = 'link';
    this.title = title;
    this.bookmarkOf = bookmarkOf;
    this.repostOf = repostOf;
    this.feedItem = content;
    this.name = name;
    this.snippet = makeSnippet(this);
    this.feedItem = makeFeedItem(this);
  }
}

export default async function loadLinkFiles({ baseUrl, dir }) {
  const filenames = await readdir(dir);
  const links = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const link = await readFile(new URL(filename, dir), 'utf8');
    const {
      properties: {
        'bookmark-of': bookmarkOf = [],
        'repost-of': repostOf = [],
        name = [],
        content = [],
        latitude,
        longitude
      }
    } = JSON.parse(link);
    const timestamp = parseInt(filename, 10);
    const href = bookmarkOf[0] || repostOf[0];

    return new LinkPage({
      baseUrl,
      content: content[0],
      timestamp,
      timezone: getTimezone(latitude, longitude),
      name: name[0],
      title: `Link to ${href}`,
      bookmarkOf: bookmarkOf[0],
      repostOf: repostOf[0]
    });
  }));

  links.sort((a, b) => b.timestamp - a.timestamp);

  return links;
}
