'use strict';

const { readFile, readdir, stat } = require('fs').promises;
const path = require('path');
const createSlug = require('./create-slug');
const makeSnippet = require('./make-snippet');
const render = require('./render');

const cache = {};

async function loadPostFile(filePath, baseUrl, type) {
  const { mtimeMs } = await stat(filePath, { bigint: true });

  if (cache[filePath] && cache[filePath].mtimeMs === mtimeMs) {
    return cache[filePath];
  }

  const post = await readFile(filePath, 'utf8');
  const [, frontMatter, body] = post.split(/^---/m);
  const filtered = frontMatter.trim()
    .split('\n')
    .filter(ln => !ln.trim().startsWith('#'))
    .join('\n');

  const attributes = JSON.parse(filtered);
  const { title, datetime, updated, tags, webmentions, draft, description, scripts, styles } = attributes;
  const slug = createSlug(title);
  const date = new Date(datetime);
  const content = await render(body);
  const snippet = makeSnippet(content);

  const digested = {
    mtimeMs,
    attributes,
    frontMatter,
    tags,
    body,
    content,
    snippet,
    description,
    scripts,
    styles,
    webmentions,
    isBlogEntry: true,
    draft,
    slug,
    localUrl: `/${type}/${slug}`,
    canonical: `${baseUrl}/${type}/${slug}`,
    filename: `${slug}.html`,
    mastodonHandle: '@qubyte@mastodon.social',
    title,
    datetime,
    updated,
    date,
    timestamp: date.getTime(),
    type: 'blog'
  };

  cache[filePath] = digested;

  return digested;
}

// Loads post source and metadata.
module.exports = async function loadPostFiles(dir, baseUrl, type = 'blog') {
  const filenames = await readdir(dir);
  const posts = await Promise.all(filenames.map(fn => loadPostFile(path.join(dir, fn), baseUrl, type)));
  const now = Date.now();

  posts.sort((a, b) => b.timestamp - a.timestamp);

  return posts.filter(post => post.timestamp < now && !post.draft);
};
