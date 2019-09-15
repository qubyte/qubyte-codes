'use strict';

const { readFile, readdir } = require('fs').promises;
const path = require('path');
const createSlug = require('./create-slug');

async function loadPostFile(filePath) {
  const post = await readFile(filePath, 'utf8');
  const [, frontMatter, body] = post.split(/^---/m);
  const filtered = frontMatter.trim()
    .split('\n')
    .filter(ln => !ln.trim().startsWith('#'))
    .join('\n');

  const attributes = JSON.parse(filtered);
  const { title, datetime, updated, tags, webmentions, draft, description, scripts } = attributes;
  const slug = createSlug(title);
  const date = new Date(datetime);

  const digested = {
    attributes,
    frontMatter,
    tags,
    body,
    description,
    scripts,
    webmentions,
    isBlogEntry: true,
    draft,
    slug,
    localUrl: `/blog/${slug}`,
    filename: `${slug}.html`,
    mastodonHandle: '@qubyte@mastodon.social',
    title,
    datetime,
    updated,
    date,
    timestamp: date.getTime(),
    type: 'blog'
  };

  return digested;
}

// Loads post source and metadata.
module.exports = async function loadPostFiles(dir) {
  const filenames = await readdir(dir);
  const posts = await Promise.all(filenames.map(fn => loadPostFile(path.join(dir, fn))));
  const now = Date.now();

  posts.sort((a, b) => b.timestamp - a.timestamp);

  return posts.filter(post => post.timestamp < now && !post.draft);
};
