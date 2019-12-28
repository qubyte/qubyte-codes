'use strict';

const highlightjs = require('highlight.js');
const marked = require('marked');
const mathjax = require('mathjax-node');
const xml2js = require('xml2js');
const urlResolve = require('url').resolve;
const { promisify } = require('util');

// A state object for mathjax to use so I can avoid ID collisions between
// equations.
const mathjaxState = {};

// MathJax has a peculiar API. I configure it and standardise the callback to
// be a nodeback.
function renderMaths(math, callback) {
  mathjax.typeset({ math, format: 'TeX', svg: true, state: mathjaxState }, ({ errors, svg }) => callback(errors, svg));
}

const mkd = promisify(marked);

module.exports = function render(string, baseUrl) {
  const renderer = new marked.Renderer();
  const oldLinkRenderer = renderer.link;

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

        // Remove unnecessary attributes.
        delete xmlobj.svg.$.style;
        delete xmlobj.svg.$.xmlns;
        delete xmlobj.svg.$['xmlns:xlink'];

        xmlobj.svg.$.class = 'mathematics';

        const builder = new xml2js.Builder({ headless: true });

        callback(null, builder.buildObject(xmlobj));
      });
    });
  }

  // Make links to external sites safe.
  renderer.link = (href, title, text) => {
    const fullyQualified = urlResolve(baseUrl, href);
    const rendered = oldLinkRenderer.call(renderer, href, title, text);

    // Anchors to pages within this site can be kept as is.
    if (fullyQualified.startsWith(baseUrl)) {
      return rendered;
    }

    // Anchors elsewhere open a new tab and don't leak context. Also include
    // mention-of class to trigger webmention dispatch.
    return rendered.replace('<a ', '<a target="_blank" rel="noopener" class="mention-of" ');
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
