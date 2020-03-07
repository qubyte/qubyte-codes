'use strict';

const highlightjs = require('highlight.js');
const marked = require('marked');
const xml2js = require('xml2js');
const { promisify, callbackify } = require('util');

const mathjax = require('mathjax-full/js/mathjax.js').mathjax;
const TeX = require('mathjax-full/js/input/tex.js').TeX;
const SVG = require('mathjax-full/js/output/svg.js').SVG;
const liteAdaptor = require('mathjax-full/js/adaptors/liteAdaptor.js').liteAdaptor;
const RegisterHTMLHandler = require('mathjax-full/js/handlers/html.js').RegisterHTMLHandler;

const AllPackages = require('mathjax-full/js/input/tex/AllPackages.js').AllPackages;
const adaptor = liteAdaptor();

RegisterHTMLHandler(adaptor); // eslint-disable-line

const tex = new TeX({ packages: AllPackages });
const svg = new SVG({ fontCache: 'local', internalSpeechTitles: true });
const html = mathjax.document('', { InputJax: tex, OutputJax: svg });

function renderMaths(math) {
  const node = html.convert(math, { display: true, containerWidth: 800 });

  return adaptor.innerHTML(node);
}

const mkd = promisify(marked);

module.exports = function render(string) {
  const renderer = new marked.Renderer();

  // Custom highlighting allows me to special case maths. Ordinary code is
  // processed by highlight.js, and mathematics by MathJax.
  async function highlight(code, language) {
    if (language !== 'mathematics') {
      return highlightjs.highlight(language, code).value;
    }

    const rendered = renderMaths(code);

    // To avoid unsafe-inline errors from my strict security headers, I
    // strip any inline styles from the maths rendered SVG. It doesn't do
    // anything anyway. I also add a "mathematics" class to apply CSS for
    // sizing and centering.
    const xmlobj = await xml2js.parseStringPromise(rendered);

    // Remove unnecessary attributes.
    delete xmlobj.svg.$.style;
    delete xmlobj.svg.$.xmlns;
    delete xmlobj.svg.$['xmlns:xlink'];

    xmlobj.svg.$.class = 'mathematics';

    const builder = new xml2js.Builder({ headless: true });

    return builder.buildObject(xmlobj);
  }

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

  return mkd(string, { highlight: callbackify(highlight), renderer });
};
