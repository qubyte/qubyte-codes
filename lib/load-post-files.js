import { stat, readdir, readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

import createSlug from './create-slug.js';
import makeSnippet from './make-snippet.js';
import checkForRubyAnnotations from './check-for-ruby-annotations.js';
import render from './render.js';
import getLocalLinks from './get-local-links.js';
import parseFrontMatter from './parse-front-matter.js';

/**
 * @param {string|URL} baseUrl
 * @param {string|URL} pageUrl
 * @param {{ href: string }[]} scripts
 * @param {Record<string, import('./hash-copy.js').HashCopiedPath>} hashedScripts
 */
function generateImportMap(baseUrl, pageUrl, scripts, hashedScripts) {
  const resolved = [];
  const hrefs = scripts.map(s => s.href);
  const queue = hrefs.map(href => new URL(href, pageUrl).pathname);

  for (let path = queue.shift(); path; path = queue.shift()) {
    if (!resolved.includes(path)) {
      const { dependencies = [] } = hashedScripts[path] || {};

      for (const dependency of dependencies) queue.push(new URL(dependency, new URL(path, baseUrl)).pathname);

      resolved.push(path);
    }
  }

  resolved.sort();

  let imports = null;

  for (const url of resolved) {
    const localHashed = hashedScripts[url];

    if (localHashed && !hrefs.includes(url)) {
      imports ||= {};
      imports[url] = localHashed.hashedFilePath;
    }
  }

  return imports && { imports };
}

/**
 * @param {Record<string, string>} a
 * @param {Record<string, string>} b
 */
function compareHashedScripts(a, b) {
  const akeys = Object.keys(a);
  const bkeys = Object.keys(b);

  return akeys.length === bkeys.length && akeys.every(k => a[k] === b[k]);
}

const cache = new Map();

// eslint-disable-next-line max-statements
async function loadPostFile({ fileUrl, basePath, baseUrl, repoUrl, type, extraCss, hashedScripts }) {
  const { mtimeMs } = await stat(fileUrl, { bigint: true });
  const cached = cache.get(fileUrl);
  const extraCssPaths = new Set(extraCss ? extraCss.values() : []);

  if (cached && cached.mtimeMs === mtimeMs && cached.styles.every(s => extraCssPaths.has(s.src))) {
    if (compareHashedScripts(cached.hashedScripts, hashedScripts)) return cached;
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
    scripts: allScripts.map(({ href }) => ({ href: hashedScripts[href]?.hashedFilePath || href })),
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
export default async function loadPostFiles({
  path,
  basePath,
  repoUrl,
  baseUrl,
  type = 'blog',
  extraCss = new Map(),
  hashedScripts
}) {
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
