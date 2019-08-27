'use strict';

const { readFile, readdir } = require('fs').promises;
const path = require('path');
const createSlug = require('./create-slug');
const makeSnippet = require('./make-snippet');
const render = require('./render');

async function loadPostFile(filePath, baseUrl) {
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
    mastodonHandle: '@qubyte@mastodon.social',
    title,
    datetime,
    updated,
    date,
    timestamp: date.getTime(),
    type: 'blog'
  };

  if (baseUrl) {
    digested.canonical = `${baseUrl}/blog/${digested.slug}`;
    digested.content = await render(digested.body, baseUrl);
    digested.snippet = makeSnippet(digested.content);
  }

  return digested;
}

// Loads and renders post source files and their metadata. Note, this renders
// content to HTML, but *not* pages. The HTML created here must be placed within
// a template to form a complete page.
module.exports = async function loadPostFiles(dir, baseUrl) {
  if (!baseUrl) {
    console.warn('load-post-files called without baseUrl. It will load but not render!'); // eslint-disable-line  no-console
  }

  const filenames = await readdir(dir);
  const posts = await Promise.all(filenames.map(fn => loadPostFile(path.join(dir, fn), baseUrl)));
  const now = Date.now();

  posts.sort((a, b) => b.timestamp - a.timestamp);

  return posts.filter(post => post.timestamp < now && !post.draft);
};
