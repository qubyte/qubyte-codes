'use strict';

const highlightjs = require('highlight.js');
const marked = require('marked');
const mathjax = require('mathjax-node');
const xml2js = require('xml2js');
const urlResolve = require('url').resolve;
const { promisify } = require('util');

// MathJax has a peculiar API. I configure it and standardise the callback to
// be a nodeback.
function renderMaths(math, callback) {
  mathjax.typeset({ math, format: 'TeX', svg: true }, ({ errors, svg }) => callback(errors, svg));
}

// Custom highlighting allows me to special case maths. Ordinary code is
// processed by highlight.js, and mathematics by MathJax.
function highlight(code, language, callback) {
  if (language !== 'mathematics') {
    return callback(null, highlightjs.highlight(language, code).value);
  }

  renderMaths(code, (err, rendered) => {
    if (err) {
      return callback(err);
    }

    // To avoid unsafe-inline errors from my strict security headers, I
    // strip any inline styles from the maths rendered SVG. It doesn't do
    // anything anyway. I also add a "mathematics" class to apply CSS for
    // sizing and centering.
    xml2js.parseString(rendered, (err, xmlobj) => {
      if (err) {
        return callback(err);
      }

      delete xmlobj.svg.$.style;

      // Remove redundant ID.
      if (xmlobj.svg.title && xmlobj.svg.title[0]) {
        delete xmlobj.svg.title[0].$.id;
      }

      xmlobj.svg.$.class = 'mathematics';

      const builder = new xml2js.Builder({ headless: true });

      callback(null, builder.buildObject(xmlobj));
    });
  });
}

const mkd = promisify(marked);

module.exports = function render(string, baseUrl) {
  const renderer = new marked.Renderer();
  const oldLinkRenderer = renderer.link;

  // Make links to external sites safe.
  renderer.link = (href, title, text) => {
    const fullyQualified = urlResolve(baseUrl, href);
    const rendered = oldLinkRenderer.call(renderer, href, title, text);

    // Anchors to pages within this site can be kept as is.
    if (fullyQualified.startsWith(baseUrl)) {
      return rendered;
    }

    // Anchors elsewhere open a new tab and don't leak context.
    return rendered.replace('<a ', '<a target="_blank" rel="noopener" ');
  };

  const codeRenderer = renderer.code;

  renderer.code = function (code, lang, escaped) {
    // Mathematics code is handled by the highlighter option below, so I can take
    // a shortcut here.
    if (lang === 'mathematics') {
      return code;
    }

    // Regular code must be rendered. Call the original code renderer,
    // maintaining it's original context.
    return codeRenderer.call(this, code, lang, escaped);
  };

  return mkd(string, { highlight, renderer });
};
