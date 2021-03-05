import { promises as fs } from 'fs';
import handlebars from 'handlebars';

const makeSnippet = handlebars
  .compile('<p class="p-summary">{{#if content}}{{content}} {{/if}}<a href="{{href}}">{{name}}</a></p>');

const makeFeedItem = handlebars
  .compile('<p>{{#if content}}{{content}} {{/if}}<a href="{{href}}">{{name}}</a></p>');

export default async function loadLinkFiles(dir, syndications) {
  const filenames = await fs.readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const link = await fs.readFile(new URL(filename, dir), 'utf8');
    const {
      properties: {
        'bookmark-of': bookmarkOf = [],
        'repost-of': repostOf = [],
        name = [],
        content = [],
        'mp-syndicate-to': rawSyndications
      }
    } = JSON.parse(link);
    const timestamp = parseInt(filename, 10);
    const filteredSyndications = [].concat(rawSyndications).filter(Boolean);
    const href = bookmarkOf[0] || repostOf[0];

    return {
      timestamp,
      localUrl: `/links/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      bookmarkOf: bookmarkOf[0],
      repostOf: repostOf[0],
      name: name[0],
      content: content[0],
      feedItem: makeFeedItem({ content, href, name }),
      title: `Link to ${href}`,
      snippet: makeSnippet({ content, href, name }),
      syndications: {
        twitter: filteredSyndications.includes(syndications.twitter),
        mastodon: filteredSyndications.includes(syndications.mastodon)
      },
      type: 'link',
      filename: `${timestamp}.html`
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
}
