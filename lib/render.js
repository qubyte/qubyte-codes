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

/**
 * The lang-span markdown extension introduces spans with language attributes.
 * In many cases the attribute can be moved to a child or parent element to
 * eliminate the span. This function works out when that is the case and
 * performs the move, returning a string with the updated content.
 * @param {string} renderedMarkdown
 */
function postRender(renderedMarkdown, footnotes) {
  const { window: { document, HTMLElement } } = new JSDOM(renderedMarkdown);

  let changes = false;

  /** @type {NodeListOf<HTMLSpanElement>} */
  const spans = document.querySelectorAll('span[lang]');

  for (const span of spans) {
    if (span.childNodes.length === 1 && span.firstChild instanceof HTMLElement) {
      // This span can be eliminated by moving its lang attribute to its only
      // child (an element).
      changes = true;
      span.firstChild.lang = span.lang;
      span.replaceWith(span.firstChild);
    } else if (!span.previousSibling && !span.nextSibling) {
      // This span has more than one node, but it has no siblings. Move the lang
      // and children of the span to its parent.
      changes = true;
      span.parentElement.lang = span.lang;
      span.replaceWith(...span.childNodes);
    }
  }

  if (footnotes.length) {
    changes = true;

    const section = document.createElement('section');
    const ol = document.createElement('ol');

    section.append(ol);
    section.classList.add('footnotes');

    ol.append(...footnotes.map((innerHTML, i) => {
      const li = document.createElement('li');
      li.id = `footnote-${i + 1}`;
      li.innerHTML = `${innerHTML}<a class="footnote-back-link" href="#footnote-ref-${i + 1}">ꜛ</a>`;
      return li;
    }));

    document.body.append(section);
  }

  return changes ? document.body.innerHTML : renderedMarkdown;
}

marked.use({
  highlight(code, language) {
    return highlightjs.highlight(code, { language }).value;
  },
  extensions: [
    {
      name: 'lang-span',
      level: 'inline',
      start(src) {
        return src.match(/\{[a-z]{2}:/)?.index;
      },
      tokenizer(src) {
        const match = src.match(/^\{([a-z-]+):/i);

        if (!match) {
          return;
        }

        const lang = match[1];
        const nextIndex = src.indexOf('}', lang.length + 2);

        if (nextIndex !== -1) {
          return {
            type: 'lang-span',
            raw: src.slice(0, nextIndex + 1),
            lang,
            inner: this.lexer.inlineTokens(src.slice(lang.length + 2, nextIndex))
          };
        }
      },
      renderer(token) {
        const addLang = this.parser.options.lang.at(-1) !== token.lang;

        if (!addLang) {
          return this.parser.parseInline(token.inner);
        }

        this.parser.options.lang.push(token.lang);

        const rendered = `<span lang="${token.lang}">${this.parser.parseInline(token.inner)}</span>`;

        this.parser.options.lang.pop();

        return rendered;
      }
    },
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

        // MathJax renders LaTeX to SVG via JSDOM. I make some modifications
        // before stringifying it to SVG text.

        const id = `equation-${this.parser.options.equation}`;
        const node = texToSvg.convert(token.inner, { display: true, containerWidth: 800 });
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
        title.append(token.inner);
        svg.prepend(title);

        return svg.outerHTML;
      }
    },
    {
      name: 'refnote',
      level: 'inline',
      start(src) {
        return src.match(/\[\^\]\[/)?.index;
      },
      tokenizer(src) {
        if (!src.startsWith('[^][')) {
          return;
        }

        const nextIndex = src.indexOf(']', 4);

        if (nextIndex !== -1) {
          return {
            type: 'refnote',
            raw: src.slice(0, nextIndex + 1),
            inner: this.lexer.inlineTokens(src.slice(4, nextIndex))
          };
        }
      },
      renderer(token) {
        const { footnotes } = this.parser.options;

        footnotes.push(this.parser.parseInline(token.inner));

        const i = footnotes.length;

        return `<sup><a id="footnote-ref-${i}" class="footnote-ref" href="#footnote-${i}">[${i}]</a></sup>`;
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
        const content = [];

        for (let i = 0; i < tokens.inner.length; i += 2) {
          const base = this.parser.parseInline(tokens.inner[i]);
          const text = this.parser.parseInline(tokens.inner[i + 1]);

          content.push(base, text ? `<rp>(</rp><rt>${text}</rt><rp>)</rp>` : '<rt></rt>');
        }

        return `<ruby>${content.join('')}</ruby>`;
      }
    }
  ]
});

/** @param {string} markdown */
export default function render(markdown) {
  const footnotes = [];
  return postRender(marked(markdown, { equation: 0, lang: ['en'], footnotes }), footnotes);
}
