'use strict';

const marked = require('marked');
const highlight = require('highlight.js');
const frontMatter = require('front-matter');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const slug = require('slug');
const remark = require('remark');
const CleanCSS = require('clean-css');

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

function renderMarkdown(post) {
  const digested = frontMatter(post);
  digested.attributes.date = new Date(digested.attributes.datetime);
  digested.attributes.slug = `${slug(digested.attributes.title, { lower: true })}.html`;
  digested.attributes.snippet = marked(makeSnippet(digested.body));
  digested.attributes.humandatetime = digested.attributes.date.toDateString();
  digested.content = marked(digested.body);
  return digested;
}

function loadPostFiles() {
  return readDir(path.join(__dirname, 'posts'))
    .then(files => Promise.all(files.map(readFile)))
    .then(contents => contents.map(renderMarkdown));
}

function loadCssFiles() {
  return Promise.all([
    'frontend/reset.css',
    'frontend/main.css',
    'frontend/code-style.css'
  ].map(readFile));
}

function compileCss(sources) {
  return new CleanCSS({ advanced: false }).minify(Array.from(sources).join('\n')).styles;
}

function writePost(post) {
  return writeFile(path.join(__dirname, 'public', 'blog', post.attributes.slug), post.html);
}

function writeIndex(indexHtml) {
  return writeFile(path.join(__dirname, 'public', 'index.html'), indexHtml);
}

exports.build = function build() {
  const promises = [
    loadPostFiles(),
    loadCssFiles(),
    loadTemplate('index.html'),
    loadTemplate('blog.html')
  ];

  return Promise.all(promises)
    .then(results => {
      const posts = results[0];
      const style = compileCss(results[1]);
      const indexTemplate = results[2];
      const blogTemplate = results[3];

      posts.sort((a, b) => b.attributes.date - a.attributes.date);

      for (const post of posts) {
        post.style = style;
        post.html = blogTemplate(post);
      }

      const indexHtml = indexTemplate({ posts, style });

      return Promise.all([writeIndex(indexHtml), ...posts.map(writePost)]);
    });
};
