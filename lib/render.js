'use strict';

const highlightjs = require('highlight.js');
const marked = require('util').promisify(require('marked'));
const { mathjax } = require('mathjax-full/js/mathjax');
const { TeX } = require('mathjax-full/js/input/tex');
const { SVG } = require('mathjax-full/js/output/svg');
const { jsdomAdaptor } = require('mathjax-full/js/adaptors/jsdomAdaptor');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages');
const { JSDOM } = require('jsdom');

const adaptor = jsdomAdaptor(JSDOM);

RegisterHTMLHandler(adaptor); // eslint-disable-line new-cap

const tex = new TeX({ packages: AllPackages });
const svg = new SVG({ fontCache: 'local', internalSpeechTitles: true });
const html = mathjax.document('', { InputJax: tex, OutputJax: svg });

// Stops highlight.js trying to do anything to mathematics.
highlightjs.registerLanguage('mathematics', () => ({ disableAutodetect: true }));
highlightjs.registerLanguage('lang:en', () => ({ disableAutodetect: true }));
highlightjs.registerLanguage('lang:ja', () => ({ disableAutodetect: true }));

// MathJax renders LaTeX to SVG via JSDOM. I make some modifications before
// stringifying it to SVG text.
function renderMaths(code, id) {
  const node = html.convert(code, { display: true, containerWidth: 800 });
  const svg = node.firstChild;

  // Remove unnecessary attributes.
  svg.removeAttribute('style');
  svg.removeAttribute('xmlns');
  svg.removeAttribute('xmlns:xlink');

  // Add a class for CSS to hook onto.
  svg.classList.add('mathematics');

  // Point the aria-labelledby attribute to the title (see below).
  svg.setAttribute('aria-labelledby', id);

  // Add a title element for tool-tips and accessibility.
  const title = adaptor.create('title');
  title.id = id;
  title.append(code);
  svg.prepend(title);

  return svg.outerHTML;
}

function unescape(string) {
  return string
    .replace(/&#39;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function buildRuby(elements) {
  let ruby = '<ruby lang="ja">';

  for (let i = 0; i < elements.length; i += 2) {
    const base = elements[i];
    const text = elements[i + 1];

    ruby += `<rb>${base}</rb>`;

    if (text) {
      ruby += `<rp>(</rp><rt>${text}</rt><rp>)</rp>`;
    } else {
      ruby += '<rt></rt>';
    }
  }

  ruby += '</ruby>';

  return ruby;
}

// Remove the lang attribute of an element when it would be selected by a
// `:lang()` selector with the same language without it. This avoids repeated
// nested lang attributes.
function postrender(string) {
  const dom = new JSDOM(string);

  // This site is in English by default.
  dom.window.document.documentElement.lang = 'en';

  // Select all elements with an explicit language attribute.
  const elementsWithLang = Array.from(dom.window.document.querySelectorAll('[lang]'));
  const langs = new Set(elementsWithLang.map(el => el.lang));

  // When there's only one element with a lang attribute it is the document
  // itself and we need do no more.
  if (langs.size < 2) {
    return string;
  }

  let changes = false;

  // When the parent of an element resolves to the same language, the language
  // attribute of the element can be dropped.
  for (const el of elementsWithLang) {
    if (el.parentElement && el.parentElement.matches(`:lang(${el.lang})`)) {
      changes = true;
      el.removeAttribute('lang');
    }
  }

  return changes ? dom.window.document.body.innerHTML : string;
}

const rubyRegexes = [
  /r\[([〜,\w\u4E00-\u9FCC\u4E00-\u9FCC\u3041-\u3096\u30A0-\u30FF\uFF5F-\uFF9F]+)\]/g,
  /r「([〜、\w\u4E00-\u9FCC\u4E00-\u9FCC\u3041-\u3096\u30A0-\u30FF\uFF5F-\uFF9F]+)」/g
];

// Globally applied options.
marked.use({
  highlight(code, language) {
    return highlightjs.highlight(language, code).value;
  },
  tokenizer: {
    // Custom handling for ruby text.
    inlineText(src) {
      const replaced = src
        .replace(rubyRegexes[0], (_, content) => buildRuby(content.split(',')))
        .replace(rubyRegexes[1], (_, content) => buildRuby(content.split('、')));

      return replaced === src ? false : { type: 'text', raw: src, text: replaced };
    }
  }
});

module.exports = function render(string) {
  // The render function is called per page, so it's ok for the equation ID to
  // go back to 0.
  let equationId = 0;

  const renderer = new marked.Renderer();
  const codeRenderer = renderer.code;

  renderer.code = function (code, lang, escaped) {
    if (lang === 'mathematics') {
      equationId++;

      const replaced = escaped ? unescape(code) : code;

      return renderMaths(replaced, `equation-${equationId}`);
    }

    // Allow text in other languages within fenced blocks. Remember to register
    // languages with highlight.js though!
    if (lang.startsWith('lang:')) {
      const replaced = escaped ? unescape(code) : code;

      return `<p lang="${lang.slice(5)}">${replaced}</p>`;
    }

    // Regular code must be rendered in a code element. Call the original code
    // renderer, maintaining the context.
    return codeRenderer.call(this, code, lang, escaped);
  };

  return marked(string, { renderer }).then(postrender);
};
