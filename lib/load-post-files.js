import { promises as fs } from 'fs';
import { join } from 'path';
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

async function loadPostFile(filePath, baseUrl, type, extraCss) {
  const { mtimeMs } = await fs.stat(filePath, { bigint: true });
  const cached = cache.get(filePath);
  const extraCssPaths = new Set(extraCss ? extraCss.values() : []);

  if (cached && cached.mtimeMs === mtimeMs && cached.styles.every(s => extraCssPaths.has(s.src))) {
    return cached;
  }

  const post = await fs.readFile(filePath, 'utf8');
  const { attributes, body } = parseFrontMatter(post);
  const { title, datetime, updated, tags, webmentions, draft, description, scripts = [], styles = [] } = attributes;
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
    styles: styles.map(({ src }) => ({ src: extraCss.get(src) })).filter(Boolean),
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

  cache.set(filePath, digested);

  return digested;
}

// Loads post source and metadata.
export default async function loadPostFiles({ path, baseUrl, type = 'blog', extraCss }) {
  const filenames = await fs.readdir(path);
  const posts = await Promise.all(filenames.map(fn => loadPostFile(join(path, fn), baseUrl, type, extraCss)));
  const now = Date.now();

  return posts
    .filter(post => post.timestamp < now && !post.draft)
    .sort((a, b) => b.timestamp - a.timestamp);
}
