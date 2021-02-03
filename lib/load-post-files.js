'use strict';

const { readFile, readdir, stat } = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');
const createSlug = require('./create-slug');
const checkForRubyAnnotations = require('./check-for-ruby-annotations');
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
  const { title, datetime, updated, tags, webmentions, draft, description, scripts = [], styles } = attributes;
  const slug = attributes.slug || createSlug(title);
  const date = new Date(datetime);
  const content = await render(body);
  const { document } = new JSDOM(content).window;
  const hasRuby = checkForRubyAnnotations(document);

  const digested = {
    mtimeMs,
    attributes,
    frontMatter,
    tags,
    body,
    content,
    snippet: content,
    hasRuby,
    description,
    scripts: hasRuby ? scripts.concat({ href: '/scripts/ruby-options.js' }) : scripts,
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

  if (styles && styles.length) {
    const content = styles.join('\n');
    const hash = crypto
      .createHash('md5')
      .update(content)
      .digest('hex');

    digested.extraStyleFile = { content, slug: `${slug}-${hash}` };
  }

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
