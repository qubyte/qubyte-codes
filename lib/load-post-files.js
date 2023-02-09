import { stat, readdir, readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

import createSlug from './create-slug.js';
import makeSnippet from './make-snippet.js';
import checkForRubyAnnotations from './check-for-ruby-annotations.js';
import render from './render.js';
import getLocalLinks from './get-local-links.js';
import parseFrontMatter from './parse-front-matter.js';

function generateImportMap(baseUrl, pageUrl, scripts, hashedScripts) {
  const resolved = new Set();
  const hrefs = scripts.map(s => s.href);
  const queue = hrefs.map(href => new URL(href, pageUrl).pathname);

  while (queue.length) {
    const path = queue.shift();

    if (resolved.has(path)) {
      continue;
    }

    const { dependencies = [] } = hashedScripts[path] || {};

    for (const dependency of dependencies) {
      queue.push(new URL(dependency, new URL(path, baseUrl)).pathname);
    }

    resolved.add(path);
  }

  const importMap = { imports: {} };
  let count = 0;

  for (const url of Array.from(resolved).sort()) {
    const localHashed = hashedScripts[url];

    if (localHashed && !hrefs.includes(url)) {
      importMap.imports[url] = localHashed.hashedFilePath;
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
async function loadPostFile({ fileUrl, basePath, baseUrl, repoUrl, type, extraCss, hashedScripts, indexJsFile }) {
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
    indexJsFile,
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
  hashedScripts,
  indexJsFile
}) {
  const filenames = await readdir(path);
  const posts = await Promise.all(filenames.map(fn => loadPostFile({
    fileUrl: new URL(fn, path),
    basePath,
    baseUrl,
    repoUrl,
    type,
    extraCss,
    hashedScripts,
    indexJsFile
  })));
  const now = Date.now();

  return posts
    .filter(post => post.timestamp < now && !post.draft)
    .sort((a, b) => b.timestamp - a.timestamp);
}
