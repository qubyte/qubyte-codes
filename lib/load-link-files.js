'use strict';

const { readdir, readFile } = require('fs').promises;
const path = require('path');

module.exports = async function loadLinkFiles(dir) {
  const filenames = await readdir(dir);
  const notes = await Promise.all(filenames.filter(fn => fn.endsWith('.json')).map(async filename => {
    const link = await readFile(path.join(dir, filename), 'utf8');
    const parsed = JSON.parse(link);
    const timestamp = parseInt(filename, 10);

    return {
      timestamp,
      localUrl: `/links/${timestamp}`,
      datetime: new Date(timestamp).toISOString(),
      bookmarkOf: parsed['bookmark-of'],
      repostOf: parsed['repost-of'],
      name: parsed.name,
      content: parsed.content,
      type: 'link'
    };
  }));

  notes.sort((a, b) => b.timestamp - a.timestamp);

  return notes;
};
