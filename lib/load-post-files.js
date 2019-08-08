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
  const digested = { attributes, frontMatter, body };
  const { title, datetime } = attributes;

  digested.isBlogEntry = true;
  digested.slug = createSlug(title);
  digested.localUrl = `/blog/${digested.slug}`;
  digested.mastodonHandle = '@qubyte@mastodon.social';
  digested.title = title;
  digested.date = new Date(datetime);
  digested.type = 'blog';

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
module.exports = async function loadPostFiles(baseUrl) {
  if (!baseUrl) {
    console.warn('load-post-files called without baseUrl. It will load but not render!'); // eslint-disable-line  no-console
  }

  const filenames = await readdir(path.join(__dirname, '..', 'content', 'posts'));
  const posts = await Promise.all(filenames.map(fn => loadPostFile(path.join(__dirname, '..', 'content', 'posts', fn), baseUrl)));
  const now = Date.now();

  posts.sort((a, b) => b.date - a.date);

  return posts.filter(post => post.date.getTime() < now && !post.attributes.draft);
};
