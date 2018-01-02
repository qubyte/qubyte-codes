'use strict';

const highlight = require('highlight.js');
const marked = require('marked');
const mathjax = require('mathjax-node');
const urlResolve = require('url').resolve;
const baseUrl = require('./baseUrl');
const renderer = new marked.Renderer();
const oldLinkRenderer = renderer.link;

// Make links to external sites safe.
renderer.link = (href, title, text) => {
  const fullyQualified = urlResolve(baseUrl, href);
  const rendered = oldLinkRenderer.call(renderer, href, title, text);

  if (fullyQualified.startsWith(baseUrl)) {
    return rendered;
  }

  return rendered.replace('<a ', '<a target="_blank" rel="noopener" ');
};

marked.setOptions({
  async highlight(code, language, callback) {
    if (language !== 'mathematics') {
      return callback(null, highlight.highlight(language, code).value);
    }

    const result = await mathjax.typeset({ math: code, format: 'TeX', svg: true });

    if (result.errors) {
      return callback(result.errors);
    }

    callback(null, result.svg);
  },
  renderer
});

module.exports = marked;
