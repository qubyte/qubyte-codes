'use strict';

const highlightjs = require('highlight.js');
const marked = require('marked');
const { mathjax } = require('mathjax-full/js/mathjax');
const { TeX } = require('mathjax-full/js/input/tex');
const { SVG } = require('mathjax-full/js/output/svg');
const { jsdomAdaptor } = require('mathjax-full/js/adaptors/jsdomAdaptor');
const { RegisterHTMLHandler: registerHtmlHandler } = require('mathjax-full/js/handlers/html');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages');
const { JSDOM } = require('jsdom');
const handlebars = require('handlebars');

registerHtmlHandler(jsdomAdaptor(JSDOM));

const texToSvg = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: 'local', internalSpeechTitles: true })
});

// MathJax renders LaTeX to SVG via JSDOM. I make some modifications before
// stringifying it to SVG text.
function renderMaths(code, id) {
  const node = texToSvg.convert(code, { display: true, containerWidth: 800 });
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
  const title = texToSvg.adaptor.create('title');
  title.id = id;
  title.append(code);
  svg.prepend(title);

  return svg.outerHTML;
}

function buildRuby(elements) {
  let ruby = '<ruby lang="ja">';

  for (let i = 0; i < elements.length; i += 2) {
    const base = elements[i];
    const text = elements[i + 1];

    ruby += `<rb>${handlebars.Utils.escapeExpression(base)}</rb>`;

    if (text) {
      ruby += `<rp>(</rp><rt>${handlebars.Utils.escapeExpression(text)}</rt><rp>)</rp>`;
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
const mathsBlockRegex = /^\$\$\n(?<content>.*)\n\$\$$/;

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
  },
  walkTokens(token) {
    if (token.type === 'paragraph') {
      const match = token.raw.match(mathsBlockRegex);

      if (match) {
        token.type = 'code';
        token.lang = 'mathematics';
        token.tokens.length = 0;
        token.text = match.groups.content;
      }
    }
  },
  renderer: {
    code(code, language) {
      if (language === 'mathematics') {
        this.options.equation++;
        return renderMaths(code, `equation-${this.options.equation}`);
      }

      return false;
    }
  }
});

module.exports = function render(string) {
  return postrender(marked(string, { equation: 0 }));
};
