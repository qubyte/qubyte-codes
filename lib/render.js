'use strict';

const highlight = require('highlight.js');
const marked = require('marked');
const mathjax = require('mathjax-node');
const xml2js = require('xml2js')
const urlResolve = require('url').resolve;
const { promisify } = require('util');
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

const codeRenderer = renderer.code;

renderer.code = function (code, lang, escaped) {
  if (lang === 'mathematics') {
    return code;
  }

  return codeRenderer.call(this, code, lang, escaped);
};

function renderMaths(math, callback) {
  mathjax.typeset({ math, format: 'TeX', svg: true }, ({ errors, svg }) => callback(errors, svg));
}

marked.setOptions({
  highlight(code, language, callback) {
    if (language !== 'mathematics') {
      return callback(null, highlight.highlight(language, code).value);
    }

    renderMaths(code, (err, rendered) => {
      if (err) {
        return callback(err);
      }

      xml2js.parseString(rendered, (err, xmlobj) => {
        if (err) {
          return callback(err);
        }

        delete xmlobj.svg.$.style;

        xmlobj.svg.$.class = 'mathematics';

        const builder = new xml2js.Builder();

        callback(null, builder.buildObject(xmlobj));
      });
    });
  },
  renderer
});

module.exports = promisify(marked);
