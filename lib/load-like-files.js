'use strict';

const { readdir, readFile } = require('fs').promises;
const path = require('path');
const makeSnippet = require('handlebars')
  .compile('<p class="p-summary">Like of <a href="{{likeOf}}">{{likeOf}}</a></p>');

module.exports = async function loadNoteFiles(dir) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const note = await readFile(path.join(dir, filename), 'utf8');
    const { properties: { 'like-of': [likeOf] } } = JSON.parse(note);
    const timestamp = parseInt(filename, 10);

    return {
      timestamp,
      localUrl: `/likes/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      likeOf,
      title: `Like of ${likeOf}`,
      type: 'like',
      filename: `${timestamp}.html`,
      snippet: makeSnippet({ likeOf })
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
};
