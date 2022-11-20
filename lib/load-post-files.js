import { stat, readdir, readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

import createSlug from './create-slug.js';
import makeSnippet from './make-snippet.js';
import checkForRubyAnnotations from './check-for-ruby-annotations.js';
import render from './render.js';
import getLocalLinks from './get-local-links.js';

export function parseFrontMatter(raw) {
  const [, frontMatter, body] = raw.split(/^---/m);
  const filtered = frontMatter.trim()
    .split('\n')
    .filter(ln => !ln.trim().startsWith('#'))
    .join('\n');

  return { attributes: JSON.parse(filtered), body };
}

function generateImportMap(baseUrl, pageUrl, scripts, hashedScripts) {
  const resolved = new Set();
  const queue = scripts.map(script => new URL(script.href, pageUrl).href);

  while (queue.length) {
    const url = queue.shift();

    if (resolved.has(url)) {
      continue;
    }

    const path = url.slice(baseUrl.length);
    const { dependencies } = hashedScripts[path] || {};

    for (const dependency of dependencies || []) {
      queue.push(new URL(dependency, url).href);
    }

    resolved.add(url.slice(baseUrl.length));
  }

  const importMap = { imports: {} };
  let count = 0;

  for (const url of Array.from(resolved).sort()) {
    const localHashed = hashedScripts[url];

    if (localHashed) {
      const referenceUrl = new URL(url, baseUrl);
      importMap.imports[url] = new URL(localHashed.hashedFileName, referenceUrl).href.slice(baseUrl.length);
      count++;
    }
  }

  return count ? importMap : null;
}

function compareHashedScripts(a, b) {
  const akeys = Object.keys(a);

  if (akeys.length !== Object.keys(b).length) {
    return false;
  }

  for (const key of akeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

const cache = new Map();

// eslint-disable-next-line max-statements
async function loadPostFile({ fileUrl, basePath, baseUrl, repoUrl, type, extraCss, hashedScripts }) {
  const { mtimeMs } = await stat(fileUrl, { bigint: true });
  const cached = cache.get(fileUrl);
  const extraCssPaths = new Set(extraCss ? extraCss.values() : []);

  if (cached && cached.mtimeMs === mtimeMs && cached.styles.every(s => extraCssPaths.has(s.src))) {
    if (compareHashedScripts(cached.hashedScripts, hashedScripts)) {
      return cached;
    }
  }

  const post = await readFile(fileUrl, 'utf8');
  const { attributes, body } = parseFrontMatter(post);
  const { title, datetime, updatedAt, tags, webmentions, draft, description, scripts = [], styles = [] } = attributes;
  const slug = attributes.slug || createSlug(title);
  const date = new Date(datetime);
  const content = render(body);
  const { document } = new JSDOM(content).window;
  const hasRuby = checkForRubyAnnotations(document);
  const canonical = `${baseUrl}/${type}/${slug}`;
  const localLinks = getLocalLinks(document, canonical, baseUrl);
  const allScripts = hasRuby ? scripts.concat({ href: '/scripts/ruby-options.js' }) : scripts;
  const importMap = generateImportMap(baseUrl, canonical, allScripts, hashedScripts);

  const digested = {
    mtimeMs,
    hashedScripts,
    attributes,
    tags,
    body,
    content,
    snippet: makeSnippet(document),
    hasRuby,
    description,
    scripts: allScripts.map(({ href }) => ({ href: importMap && importMap.imports[href] || href })),
    importMapObject: importMap,
    importMap: importMap && JSON.stringify(importMap),
    styles: styles.map(({ src }) => ({ src: extraCss.get(src) })).filter(Boolean),
    webmentions,
    isBlogEntry: true,
    draft,
    slug,
    localUrl: `/${type}/${slug}`,
    canonical,
    localLinks,
    filename: `${slug}.html`,
    mastodonHandle: '@qubyte@mastodon.social',
    title,
    datetime,
    updatedAt,
    date,
    timestamp: date.getTime(),
    type: 'blog',
    editUrl: `${repoUrl}/edit/main/${fileUrl.href.slice(basePath.href.length)}` // Assumes GitHub and main branch.
  };

  cache.set(fileUrl, digested);

  return digested;
}

// Loads post source and metadata.
export default async function loadPostFiles({ path, basePath, repoUrl, baseUrl, type = 'blog', extraCss = new Map(), hashedScripts }) {
  const filenames = await readdir(path);
  const posts = await Promise.all(filenames.map(fn => loadPostFile({
    fileUrl: new URL(fn, path),
    basePath,
    baseUrl,
    repoUrl,
    type,
    extraCss,
    hashedScripts
  })));
  const now = Date.now();

  return posts
    .filter(post => post.timestamp < now && !post.draft)
    .sort((a, b) => b.timestamp - a.timestamp);
}
