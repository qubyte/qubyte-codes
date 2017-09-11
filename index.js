'use strict';

const frontMatter = require('front-matter');
const path = require('path');
const crypto = require('crypto');
const handlebars = require('handlebars');
const makeSlug = require('slug');
const remark = require('remark');
const render = require('./lib/render');
const baseUrl = require('./lib/baseUrl');
const fs = require('fs');
const { promisify } = require('util');

const readDir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const rename = promisify(fs.rename);
const writeFile = promisify(fs.writeFile);

function buildPublicPath(...parts) {
  return path.join(__dirname, 'public', ...parts);
}

async function hashAndMoveCss() {
  const content = await readFile(buildPublicPath('main.css'), 'utf-8');

  const hash = crypto
    .createHash('md5')
    .update(content)
    .digest('hex');

  const oldPath = buildPublicPath('main.css');
  const newPath = buildPublicPath(`main-${hash}.css`);

  await rename(oldPath, newPath);

  return `main-${hash}.css`;
}

async function loadTemplate(filename) {
  const source = await readFile(path.join(__dirname, 'frontend', filename), 'utf-8');

  return handlebars.compile(source);
}

function makeSnippet(body) {
  const ast = remark().parse(body);

  for (const child of ast.children) {
    if (child.type === 'paragraph') {
      return remark()
        .stringify(child)
        .slice(0, -1);
    }
  }

  return '';
}

function dateToIso(date) {
  return date.toISOString().replace(/\.[0-9]{3}Z/, 'Z');
}

function renderMarkdown(post) {
  const digested = frontMatter(post);
  const { title, tags = [] } = digested.attributes;
  const slug = `${makeSlug(title, { lower: true })}`;
  const canonical = `${baseUrl}/blog/${slug}`;
  const date = new Date(digested.attributes.datetime);
  const updated = new Date(digested.attributes.updated || digested.attributes.datetime);

  digested.attributes.date = date;
  digested.attributes.updated = updated;
  digested.attributes.slug = slug;
  digested.attributes.filename = `${slug}.html`;
  digested.attributes.snippet = render(makeSnippet(digested.body));
  digested.attributes.humandatetime = date.toDateString();
  digested.attributes.isoDate = dateToIso(date);
  digested.attributes.isoUpdated = dateToIso(updated);
  digested.attributes.tweetText = encodeURIComponent(`Qubyte Codes - ${title}`);
  digested.attributes.tootText = encodeURIComponent(
    `Qubyte Codes - ${title} via @qubyte@mastodon.social ${tags.map(t => `#${t}`).join(' ')} ${canonical}`
  );
  digested.attributes.canonical = encodeURIComponent(canonical);
  digested.content = render(digested.body);
  return digested;
}

async function loadPostFiles() {
  const filenames = await readDir(path.join(__dirname, 'posts'));
  const filePaths = filenames.map(filename => path.join(__dirname, 'posts', filename));
  const contents = await Promise.all(filePaths.map(path => readFile(path, 'utf-8')));

  return contents.map(renderMarkdown);
}

exports.build = async function build() {
  const loadPromises = [
    loadPostFiles(),
    loadTemplate('index.html'),
    loadTemplate('about.html'),
    loadTemplate('blog.html'),
    loadTemplate('atom.xml'),
    loadTemplate('sitemap.txt'),
    hashAndMoveCss()
  ];

  const [posts, indexTemplate, aboutTemplate, blogTemplate, atomTemplate, sitemapTemplate, cssPath] = await Promise.all(loadPromises);

  posts.sort((a, b) => b.attributes.date - a.attributes.date);

  const dev = process.env.NODE_ENV === 'development';

  for (const post of posts) {
    post.dev = dev;
    post.cssPath = cssPath;
    post.html = blogTemplate(post);
  }

  const indexHtml = indexTemplate({ posts, cssPath, dev });
  const aboutHtml = aboutTemplate({ cssPath, dev });
  const atomXML = atomTemplate({ posts, updated: dateToIso(new Date()) });
  const sitemapTxt = sitemapTemplate({ posts });

  await Promise.all([
    writeFile(buildPublicPath('index.html'), indexHtml),
    writeFile(buildPublicPath('about.html'), aboutHtml),
    ...posts.map(post => writeFile(buildPublicPath('blog', post.attributes.filename), post.html)),
    writeFile(buildPublicPath('atom.xml'), atomXML),
    writeFile(buildPublicPath('sitemap.txt'), sitemapTxt)
  ]);
};
