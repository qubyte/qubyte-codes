'use strict';

const highlightjs = require('highlight.js');
const marked = require('util').promisify(require('marked'));
const { mathjax } = require('mathjax-full/js/mathjax');
const { TeX } = require('mathjax-full/js/input/tex');
const { SVG } = require('mathjax-full/js/output/svg');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages');

const adaptor = liteAdaptor();

RegisterHTMLHandler(adaptor); // eslint-disable-line new-cap

const tex = new TeX({ packages: AllPackages });
const svg = new SVG({ fontCache: 'local', internalSpeechTitles: true });
const html = mathjax.document('', { InputJax: tex, OutputJax: svg });

// Stops highlight.js trying to do anything to mathematics.
highlightjs.registerLanguage('mathematics', () => ({ disableAutodetect: true }));

// A callback wrapper around highlight.js.
function highlight(code, language, callback) {
  return callback(null, highlightjs.highlight(language, code).value);
}

// MathJax renders LaTeX to SVG via a light DOM implementation. I make some
// modifications to that DOM before stringifying it to SVG text.
function renderMaths(code, id) {
  const node = html.convert(code, { display: true, containerWidth: 800 });
  const svg = node.children[0];

  // Remove unnecessary attributes.
  delete svg.attributes.style;
  delete svg.attributes.xmlns;
  delete svg.attributes['xmlns:xlink'];

  // Add a class for CSS to hook onto.
  svg.attributes.class = 'mathematics';

  // Point the aria-labelledby attribute to the title (see below).
  svg.attributes['aria-labelledby'] = id;

  // Add a title element for tool-tips and accessibility.
  const title = adaptor.create('title');
  title.attributes.id = id;
  adaptor.append(title, adaptor.text(code));
  adaptor.append(svg, title);

  return adaptor.innerHTML(node);
}

function unescape(string) {
  return string
    .replace(/&#39;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

module.exports = function render(string) {
  // The render function is called per page, so it's ok for the equation ID to
  // go back to 0.
  let equationId = 0;

  const renderer = new marked.Renderer();
  const codeRenderer = renderer.code;

  renderer.code = function (code, lang, escaped) {
    // Regular code must be rendered in a code element. Call the original code
    // renderer, maintaining the context.
    if (lang !== 'mathematics') {
      return codeRenderer.call(this, code, lang, escaped);
    }

    equationId++;

    const replaced = escaped ? unescape(code) : code;

    return renderMaths(replaced, `equation-${equationId}`);
  };

  return marked(string, { highlight, renderer });
};
