'use strict';

const { readdir, readFile } = require('fs').promises;
const path = require('path');
const makeSnippet = require('handlebars')
  .compile('{{#if content}}<p>{{content}}</p>{{/if}}<p><a href="{{href}}">{{name}}</a></p>');

module.exports = async function loadLinkFiles(dir, syndications) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const link = await readFile(path.join(dir, filename), 'utf8');
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

    return {
      timestamp,
      localUrl: `/links/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      bookmarkOf: bookmarkOf[0],
      repostOf: repostOf[0],
      name: name[0],
      content: content[0],
      title: `Link ${index}`,
      snippet: makeSnippet({ content, href: bookmarkOf || repostOf, name }),
      syndications: {
        twitter: filteredSyndications.includes(syndications.twitter),
        mastodon: filteredSyndications.includes(syndications.mastodon)
      },
      type: 'link'
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
};
