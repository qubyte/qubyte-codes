'use strict';

const marked = require('marked');
const highlight = require('highlight.js');
const frontMatter = require('front-matter');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const slug = require('slug');
const remark = require('remark');

marked.setOptions({
  highlight(code) {
    return highlight.highlightAuto(code).value;
  }
});

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

function loadTemplate(filename) {
  return readFile(path.join(__dirname, 'frontend', filename))
    .then(source => handlebars.compile(source));
}

function makeSnippet(body) {
  const ast = remark.parse(body);

  for (const child of ast.children) {
    if (child.type === 'paragraph') {
      return remark.stringify(child);
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

function loadPostFiles() {
  return readDir(path.join(__dirname, 'posts'))
    .then(files => Promise.all(files.map(readFile)))
    .then(contents => contents.map(renderMarkdown));
}

exports.build = function build() {
  const promises = [
    loadPostFiles(),
    loadTemplate('index.html'),
    loadTemplate('blog.html'),
    loadTemplate('atom.xml'),
    loadTemplate('sitemap.txt')
  ];

  return Promise.all(promises)
    .then(([posts, indexTemplate, blogTemplate, atomTemplate, sitemapTemplate]) => {
      posts.sort((a, b) => b.attributes.date - a.attributes.date);

      for (const post of posts) {
        post.html = blogTemplate(post);
      }

      const indexHtml = indexTemplate({ posts });
      const atomXML = atomTemplate({ posts, updated: dateToIso(new Date()) });
      const sitemapTxt = sitemapTemplate({ posts });
      const buildPublicPath = (...parts) => path.join(__dirname, 'public', ...parts);

      return Promise.all([
        writeFile(buildPublicPath('index.html'), indexHtml),
        ...posts.map(post => writeFile(buildPublicPath('blog', post.attributes.filename), post.html)),
        writeFile(buildPublicPath('atom.xml'), atomXML),
        writeFile(buildPublicPath('sitemap.txt'), sitemapTxt)
      ]);
    });
};
