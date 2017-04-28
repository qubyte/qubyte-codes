'use strict';

const frontMatter = require('front-matter');
const path = require('path');
const crypto = require('crypto');
const handlebars = require('handlebars');
const slug = require('slug');
const remark = require('remark');
const render = require('./lib/render');
const baseUrl = require('./lib/baseUrl');
const fs = require('./lib/fs');

function buildPublicPath(...parts) {
  return path.join(__dirname, 'public', ...parts);
}

async function hashAndMoveCss() {
  const content = await fs.readFile(buildPublicPath('main.css'));

  const hash = crypto
    .createHash('md5')
    .update(content)
    .digest('hex');

  const oldPath = buildPublicPath('main.css');
  const newPath = buildPublicPath(`main-${hash}.css`);

  await fs.rename(oldPath, newPath);

  return `main-${hash}.css`;
}

async function loadTemplate(filename) {
  const source = await fs.readFile(path.join(__dirname, 'frontend', filename));

  return handlebars.compile(source);
}

function makeSnippet(body) {
  const ast = remark().parse(body);

  for (const child of ast.children) {
    if (child.type === 'paragraph') {
      const stringified = remark().stringify(child);
      return `“${stringified.slice(0, -1)}…”`;
    }
  }

  return '';
}

function dateToIso(date) {
  return date.toISOString().replace(/\.[0-9]{3}Z/, 'Z');
}

function renderMarkdown(post) {
  const digested = frontMatter(post);
  digested.attributes.date = new Date(digested.attributes.datetime);
  digested.attributes.updated = new Date(digested.attributes.updated || digested.attributes.datetime);
  digested.attributes.slug = `${slug(digested.attributes.title, { lower: true })}`;
  digested.attributes.filename = `${digested.attributes.slug}.html`;
  digested.attributes.snippet = render(makeSnippet(digested.body));
  digested.attributes.humandatetime = digested.attributes.date.toDateString();
  digested.attributes.isoDate = dateToIso(digested.attributes.date);
  digested.attributes.isoUpdated = dateToIso(digested.attributes.updated);
  digested.attributes.tweetText = encodeURIComponent(`Qubyte Codes - ${digested.attributes.title}`);
  digested.attributes.canonical = encodeURIComponent(`${baseUrl}/${digested.attributes.slug}`);
  digested.content = render(digested.body);
  return digested;
}

async function loadPostFiles() {
  const files = await fs.readDir(path.join(__dirname, 'posts'));
  const contents = await Promise.all(files.map(fs.readFile));

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

  for (const post of posts) {
    post.cssPath = cssPath;
    post.html = blogTemplate(post);
  }

  const indexHtml = indexTemplate({ posts, cssPath });
  const aboutHtml = aboutTemplate({ cssPath });
  const atomXML = atomTemplate({ posts, updated: dateToIso(new Date()) });
  const sitemapTxt = sitemapTemplate({ posts });

  await Promise.all([
    fs.writeFile(buildPublicPath('index.html'), indexHtml),
    fs.writeFile(buildPublicPath('about.html'), aboutHtml),
    ...posts.map(post => fs.writeFile(buildPublicPath('blog', post.attributes.filename), post.html)),
    fs.writeFile(buildPublicPath('atom.xml'), atomXML),
    fs.writeFile(buildPublicPath('sitemap.txt'), sitemapTxt)
  ]);
};
