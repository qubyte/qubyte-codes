'use strict';

const marked = require('marked');
const highlight = require('highlight.js');
const frontMatter = require('front-matter');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const slug = require('slug');
const remark = require('remark');
const blogTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, 'frontend', 'blog.html'), 'utf8'));
const indexTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, 'frontend', 'index.html'), 'utf8'));

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

function makeSnippet(body) {
  const ast = remark.parse(body);

  for (const child of ast.children) {
    if (child.type === 'paragraph') {
      return remark.stringify(child);
    }
  }
}

function renderMarkdown(post) {
  const digested = frontMatter(post);
  digested.attributes.date = new Date(digested.attributes.datetime);
  digested.attributes.slug = `${slug(digested.attributes.title, { lower: true })}.html`;
  digested.attributes.snippet = makeSnippet(digested.body);
  digested.attributes.humandatetime = digested.attributes.date.toDateString();
  digested.content = marked(digested.body);
  return digested;
}

function loadPostFiles() {
  return readDir(path.join(__dirname, 'posts'))
    .then(files => Promise.all(files.map(readFile)))
    .then(contents => contents.map(renderMarkdown));
}

function order(posts) {
  posts.sort((a, b) => new Date(a) - new Date(b));

  for (let i = 0, len = posts.length; i < len; i++) {
    Object.assign(posts[i].attributes, {
      linkPrev: posts[i - 1] && `/blog/${posts[i - 1].attributes.slug}`,
      linkNext: posts[i + 1] && `/blog/${posts[i + 1].attributes.slug}`
    });
  }
}

function writeFile(path, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, content, err => err ? reject(err) : resolve());
  });
}

function writePost(post) {
  return writeFile(path.join(__dirname, 'public', 'blog', post.attributes.slug), post.html);
}

function writeIndex(indexHtml) {
  return writeFile(path.join(__dirname, 'public', 'index.html'), indexHtml);
}

exports.build = function build() {
  return loadPostFiles()
    .then(posts => {
      order(posts);

      for (const post of posts) {
        post.html = blogTemplate(post);
      }

      const indexHtml = indexTemplate({ posts });

      return Promise.all([writeIndex(indexHtml), ...posts.map(writePost)]);
    });
};
