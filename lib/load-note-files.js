'use strict';

const { readdir, readFile } = require('fs').promises;
const path = require('path');
const makeSnippet = require('handlebars').compile('<p>{{content}}</p>');

module.exports = async function loadNoteFiles(dir) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async (filename, index) => {
    const note = await readFile(path.join(dir, filename), 'utf8');
    const { properties: { content: [content], photo } } = JSON.parse(note);
    const timestamp = parseInt(filename, 10);

    return {
      timestamp,
      localUrl: `/notes/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      content,
      photo: photo && photo.map(p => typeof p === 'string' ? { value: p, content } : p),
      title: `Note ${index}`,
      snippet: makeSnippet({ content }),
      type: 'note'
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
};
