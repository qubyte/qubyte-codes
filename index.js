'use strict';

const marked = require('marked');
const highlight = require('highlight.js');
const frontMatter = require('front-matter');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const handlebars = require('handlebars');
const slug = require('slug');
const remark = require('remark');

marked.setOptions({
  highlight(code, language) {
    return highlight.highlight(language, code).value;
  }
});

function buildPublicPath(...parts) {
  return path.join(__dirname, 'public', ...parts);
}

function readDir(dir) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, files) => {
      if (err) {
        return reject(err);
      }

      resolve(files.map(file => path.join(dir, file)));
    });
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (err, content) => err ? reject(err) : resolve(content));
  });
}

function writeFile(path, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, content, err => err ? reject(err) : resolve());
  });
}

function rename(oldPath, newPath) {
  return new Promise((resolve, reject) => {
    fs.rename(oldPath, newPath, err => err ? reject(err) : resolve());
  });
}

async function hashAndMoveCss() {
  const content = await readFile(buildPublicPath('main.css'));

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
  const source = await readFile(path.join(__dirname, 'frontend', filename));

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
  digested.attributes.snippet = marked(makeSnippet(digested.body));
  digested.attributes.humandatetime = digested.attributes.date.toDateString();
  digested.attributes.isoDate = dateToIso(digested.attributes.date);
  digested.attributes.isoUpdated = dateToIso(digested.attributes.updated);
  digested.attributes.tweetText = encodeURIComponent(`Qubyte Codes - ${digested.attributes.title}`);
  digested.attributes.canonical = encodeURIComponent(`https://qubyte.codes/blog/${digested.attributes.slug}`);
  digested.content = marked(digested.body);
  return digested;
}

async function loadPostFiles() {
  const files = await readDir(path.join(__dirname, 'posts'));
  const contents = await Promise.all(files.map(readFile));

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
    loadTemplate('sw-sitemap.txt'),
    hashAndMoveCss()
  ];

  const [posts, indexTemplate, aboutTemplate, blogTemplate, atomTemplate, sitemapTemplate, swSitemapTemplate, cssPath] = await Promise.all(loadPromises);

  posts.sort((a, b) => b.attributes.date - a.attributes.date);

  for (const post of posts) {
    post.cssPath = cssPath;
    post.html = blogTemplate(post);
  }

  const indexHtml = indexTemplate({ posts, cssPath });
  const aboutHtml = aboutTemplate({ cssPath });
  const atomXML = atomTemplate({ posts, updated: dateToIso(new Date()) });
  const sitemapTxt = sitemapTemplate({ posts });
  const swSitemapTxt = swSitemapTemplate({ posts, cssPath });

  await Promise.all([
    writeFile(buildPublicPath('index.html'), indexHtml),
    writeFile(buildPublicPath('about.html'), aboutHtml),
    ...posts.map(post => writeFile(buildPublicPath('blog', post.attributes.filename), post.html)),
    writeFile(buildPublicPath('atom.xml'), atomXML),
    writeFile(buildPublicPath('sitemap.txt'), sitemapTxt),
    writeFile(buildPublicPath('sw-sitemap.txt'), swSitemapTxt)
  ]);
};
