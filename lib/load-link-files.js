'use strict';

const { readdir, readFile } = require('fs').promises;
const path = require('path');
const makeSnippet = require('handlebars')
  .compile('{{#if content}}<p>{{content}}</p>{{/if}}<p><a href="{{href}}">{{name}}</a></p>');

module.exports = async function loadLinkFiles(dir) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const link = await readFile(path.join(dir, filename), 'utf8');
    const { 'bookmark-of': bookmarkOf, 'repost-of': repostOf, name, content } = JSON.parse(link);
    const timestamp = parseInt(filename, 10);

    return {
      timestamp,
      localUrl: `/links/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      bookmarkOf,
      repostOf,
      name,
      content,
      title: `Link ${index}`,
      snippet: makeSnippet({ content, href: bookmarkOf || repostOf, name }),
      type: 'link'
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
};
