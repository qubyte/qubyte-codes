// @ts-check

import { stat, readdir, readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

import createSlug from './create-slug.js';
import makeSnippet from './make-snippet.js';
import checkForRubyAnnotations from './check-for-ruby-annotations.js';
import checkForMaths from './check-for-maths.js';
import checkForCodeHighlight from './check-for-code-highlight.js';
import render from './render.js';
import getLocalLinks from './get-local-links.js';
import generateImportMap from './generate-import-map.js';
import parseFrontMatter from './parse-front-matter.js';
import Page from './page.js';
import makeOgImage from './patchwork-png.js';

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

function getCached({ fileUrl, mtimeMs, extraCss, hashedScripts }) {
  const cached = cache.get(fileUrl);
  const extraCssPaths = new Set(extraCss ? extraCss.values() : []);

  if (cached && cached.mtimeMs === mtimeMs && cached.styles.every(s => extraCssPaths.has(s.src))) {
    if (compareHashedScripts(cached.hashedScripts, hashedScripts)) {
      return cached;
    }
  }

  return null;
}

export class PostPage extends Page {
  /**
   * @param {object} options
   * @param {string|URL} options.baseUrl
   * @param {string} options.localUrl
   * @param {string} options.content
   * @param {string} options.filename
   * @param {BigInt} options.mtimeMs
   * @param {Record<string, import('./hash-copy.js').HashCopiedPath>} options.hashedScripts
   * @param {Record<string, any>} options.attributes
   * @param {string[]} options.tags
   * @param {{src:string}[]} options.scripts
   * @param {string} options.description
   * @param {{href:string}[]} options.styles
   * @param {Map<string, string>} options.extraCss
   * @param {any} options.webmentions
   * @param {Boolean} options.draft
   * @param {string} options.slug
   * @param {string} options.title
   * @param {string} options.datetime
   * @param {string} options.updatedAt
   * @param {string} options.editUrl
   */
  // eslint-disable-next-line max-statements
  constructor({
    baseUrl,
    localUrl,
    content,
    filename,
    mtimeMs,
    hashedScripts,
    attributes,
    tags,
    scripts,
    description,
    styles,
    extraCss,
    webmentions,
    draft,
    slug,
    title,
    datetime,
    updatedAt,
    editUrl
  }) {
    super({ baseUrl, localUrl, content, filename });

    this.mtimeMs = mtimeMs;
    this.tags = tags;
    this.customHeaders = attributes.customHeaders;
    this.description = description;
    this.webmentions = webmentions;
    this.isBlogEntry = true;
    this.draft = draft;
    this.slug = slug;
    this.mastodonHandle = '@qubyte@mastodon.social';
    this.title = title;
    this.datetime = datetime;
    this.updatedAt = updatedAt;
    this.date = new Date(datetime);
    this.timestamp = this.date.getTime();
    this.type = 'blog';
    this.editUrl = editUrl;
    this.ogImage = makeOgImage(Number(mtimeMs));

    const { document } = new JSDOM(this.content, { url: this.canonical.href }).window;
    const allStyles = styles.slice();

    if (checkForMaths(document)) {
      allStyles.push({ href: '/styles/temml.css' });
    }
    if (checkForCodeHighlight(document)) {
      allStyles.push({ href: '/styles/highlightjs.css' });
    }

    /** @type {{href: string}[]} */
    this.styles = [];

    for (const { href } of allStyles) {
      const hashed = extraCss.get(href);

      if (hashed) {
        this.styles.push({ href: hashed });
      }
    }

    this.snippet = makeSnippet(document);
    this.hasRuby = checkForRubyAnnotations(document);
    this.localLinks = getLocalLinks(document);

    const allScripts = this.hasRuby ? scripts.concat({ src: '/scripts/ruby-options.js' }) : scripts;

    this.importMapObject = generateImportMap(this.canonical, allScripts, hashedScripts);
    this.importMap = this.importMapObject && JSON.stringify(this.importMapObject);
    this.scripts = allScripts.map(({ src }) => ({ src: hashedScripts[src]?.hashedFilePath || src }));
  }
}

async function loadPostFile({ fileUrl, basePath, baseUrl, repoUrl, type, extraCss, hashedScripts, images }) {
  const { mtimeMs } = await stat(fileUrl, { bigint: true });
  const cached = getCached({ fileUrl, mtimeMs, extraCss, hashedScripts });

  if (cached) {
    return cached;
  }

  const post = await readFile(fileUrl, 'utf8');
  const { attributes, body } = parseFrontMatter(post);
  const { title, datetime, updatedAt, tags, webmentions, draft, description, scripts = [], styles = [] } = attributes;
  const slug = attributes.slug || createSlug(title);
  const localUrl = type ? `/${type}/${slug}` : `/${slug}`;
  const content = render(body, images);
  const editUrl = `${repoUrl}/edit/main/${fileUrl.href.slice(basePath.href.length)}`; // Assumes GitHub and main branch.

  const digested = new PostPage({
    baseUrl,
    localUrl,
    content,
    filename: `${slug}.html`,
    mtimeMs,
    hashedScripts,
    attributes,
    tags,
    scripts,
    description,
    styles,
    extraCss,
    webmentions,
    draft,
    slug,
    title,
    datetime,
    updatedAt,
    editUrl
  });

  cache.set(fileUrl, digested);

  return digested;
}

// Loads post source and metadata.
export default async function loadPostFiles({
  path,
  basePath,
  repoUrl,
  baseUrl,
  type,
  extraCss = new Map(),
  hashedScripts,
  images
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
    images
  })));
  const now = Date.now();

  return posts
    .filter(post => post.timestamp < now && !post.draft)
    .sort((a, b) => b.timestamp - a.timestamp);
}
