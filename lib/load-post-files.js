'use strict';

const { readFile, readdir } = require('fs').promises;
const path = require('path');
const createSlug = require('./create-slug');
const makeSnippet = require('./make-snippet');
const makeRenderer = require('./make-renderer');

let render;

async function loadPostFile(filePath, baseUrl) {
  if (!render) {
    render = makeRenderer(baseUrl);
  }

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
  digested.canonical = `${baseUrl}/blog/${digested.slug}`;
  digested.localUrl = `/blog/${digested.slug}`;
  digested.mastodonHandle = '@qubyte@mastodon.social';
  digested.content = await render(digested.body);
  digested.snippet = makeSnippet(digested.content);
  digested.title = `Qubyte Codes - ${title}`;
  digested.date = new Date(datetime);

  return digested;
}

// Loads and renders post source files and their metadata. Note, this renders
// content to HTML, but *not* pages. The HTML created here must be placed within
// a template to form a complete page.
module.exports = async function loadPostFiles(baseUrl) {
  const filenames = await readdir(path.join(__dirname, '..', 'content', 'posts'));
  const posts = await Promise.all(filenames.map(fn => loadPostFile(path.join(__dirname, '..', 'content', 'posts', fn), baseUrl)));
  const now = Date.now();

  posts.sort((a, b) => b.date - a.date);

  return posts.filter(post => post.date.getTime() < now && !post.attributes.draft);
};
