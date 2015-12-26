'use strict';

const marked = require('marked');
const highlight = require('highlight.js');
const frontMatter = require('front-matter');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const slug = require('slug');
const blogTemplate = handlebars.compile(fs.readFileSync(path.join(__dirname, 'frontend', 'blog.html'), 'utf8'));

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

function renderMarkdown(post) {
  const digested = frontMatter(post);
  digested.attributes.date = new Date(digested.attributes.datetime);
  digested.attributes.slug = `${slug(digested.attributes.title, { lower: true })}.html`;
  digested.rendered = marked(digested.body);
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

function writePost(post) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path.join(__dirname, 'public', 'blog', post.attributes.slug), post.html, err => err ? reject(err) : resolve());
  });
}

function renderTemplate(post) {
  return blogTemplate({
    'link-prev': post.attributes.linkPrev && { link: post.attributes.linkPrev },
    'link-next': post.attributes.linkNext && { link: post.attributes.linkNext },
    title: post.attributes.title,
    datetime: post.attributes.datetime,
    'human-datetime': post.attributes.date.toDateString(),
    content: post.rendered
  });
}

exports.build = function build() {
  return loadPostFiles()
    .then(posts => {
      order(posts);

      for (const post of posts) {
        post.html = renderTemplate(post);
      }

      return Promise.all(posts.map(writePost));
    });
};
