import highlightjs from 'highlight.js';
import marked from 'marked';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { jsdomAdaptor } from 'mathjax-full/js/adaptors/jsdomAdaptor.js';
import { RegisterHTMLHandler as registerHtmlHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { JSDOM } from 'jsdom';

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
  const content = [];

  for (let i = 0; i < elements.length; i += 2) {
    const base = elements[i];
    const text = elements[i + 1];

    content.push(base, text ? `<rp>(</rp><rt>${text}</rt><rp>)</rp>` : '<rt></rt>');
  }

  return `<ruby lang="ja">${content.join('')}</ruby>`;
}

// Remove the lang attribute of an element when it would be selected by a
// `:lang()` selector with the same language without it. This avoids repeated
// nested lang attributes.
function postrender(string) {
  const dom = new JSDOM(string);

  // This site is in English by default.
  dom.window.document.documentElement.lang = 'en';

  // Select all elements with an explicit language attribute.
  const elementsWithLang = dom.window.document.querySelectorAll('[lang]');
  const langs = new Set();

  for (const { lang } of elementsWithLang) {
    langs.add(lang);
  }

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

marked.use({
  highlight(code, language) {
    return highlightjs.highlight(code, { language }).value;
  },
  extensions: [
    {
      name: 'mark',
      level: 'inline',
      start(src) {
        return src.match(/==(?!\s)/)?.index;
      },
      tokenizer(src) {
        if (!src.startsWith('==')) {
          return;
        }

        const nextIndex = src.indexOf('==', 2);

        if (nextIndex !== -1) {
          return {
            type: 'mark',
            raw: src.slice(0, nextIndex + 2),
            inner: this.lexer.inlineTokens(src.slice(2, nextIndex))
          };
        }
      },
      renderer(token) {
        return `<mark>${this.parser.parseInline(token.inner)}</mark>`;
      }
    },
    {
      name: 'maths-block',
      level: 'block',
      start(src) {
        return src.match(/^\$\$$/)?.index;
      },
      tokenizer(src) {
        if (!src.startsWith('$$\n')) {
          return;
        }

        const nextIndex = src.indexOf('\n$$');

        if (nextIndex !== -1) {
          return {
            type: 'maths-block',
            raw: src.slice(0, nextIndex + 3),
            inner: src.slice(3, nextIndex)
          };
        }
      },
      renderer(token) {
        this.parser.options.equation++;
        return renderMaths(token.inner, `equation-${this.parser.options.equation}`);
      }
    },
    {
      name: 'ruby',
      level: 'inline',
      start(src) {
        return src.match(/\^/)?.index;
      },
      tokenizer(src) {
        if (!src.startsWith('^')) {
          return;
        }

        const nextIndex = src.indexOf('^', 1);

        if (nextIndex !== -1) {
          return {
            type: 'ruby',
            raw: src.slice(0, nextIndex + 1),
            inner: src
              .slice(1, nextIndex)
              .split(',')
              .map(el => this.lexer.inlineTokens(el))
          };
        }
      },
      renderer(tokens) {
        return buildRuby(tokens.inner.map(el => this.parser.parseInline(el)));
      }
    }
  ]
});

export default function render(string) {
  return postrender(marked(string, { equation: 0 }));
}
