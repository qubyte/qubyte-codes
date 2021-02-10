import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { JSDOM } from 'jsdom';

import createSlug from './create-slug.js';
import makeSnippet from './make-snippet.js';
import checkForRubyAnnotations from './check-for-ruby-annotations.js';
import render from './render.js';

function parseFrontMatter(raw) {
  const [, frontMatter, body] = raw.split(/^---/m);
  const filtered = frontMatter.trim()
    .split('\n')
    .filter(ln => !ln.trim().startsWith('#'))
    .join('\n');

  return { attributes: JSON.parse(filtered), body };
}

const cache = new Map();

async function loadPostFile(filePath, baseUrl, type) {
  const { mtimeMs } = await fs.stat(filePath, { bigint: true });
  const cached = cache.get(filePath);

  if (cached && cached.mtimeMs === mtimeMs) {
    return cached;
  }

  const post = await fs.readFile(filePath, 'utf8');
  const { attributes, body } = parseFrontMatter(post);
  const { title, datetime, updated, tags, webmentions, draft, description, scripts = [], styles } = attributes;
  const slug = attributes.slug || createSlug(title);
  const date = new Date(datetime);
  const content = await render(body);
  const { document } = new JSDOM(content).window;
  const hasRuby = checkForRubyAnnotations(document);

  const digested = {
    mtimeMs,
    attributes,
    tags,
    body,
    content,
    snippet: makeSnippet(document),
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

  cache.set(filePath, digested);

  return digested;
}

// Loads post source and metadata.
export default async function loadPostFiles(dir, baseUrl, type = 'blog') {
  const filenames = await fs.readdir(dir);
  const posts = await Promise.all(filenames.map(fn => loadPostFile(path.join(dir, fn), baseUrl, type)));
  const now = Date.now();

  posts.sort((a, b) => b.timestamp - a.timestamp);

  return posts.filter(post => post.timestamp < now && !post.draft);
}
