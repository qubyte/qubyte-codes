import highlightjs from 'highlight.js';
import { marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { markedHighlight } from 'marked-highlight';
import temml from 'temml/dist/temml.mjs';
import { JSDOM } from 'jsdom';
import composePicture from './compose-picture.js';

/**
 * The lang-span markdown extension introduces spans with language attributes.
 * In many cases the attribute can be moved to a child or parent element to
 * eliminate the span. This function works out when that is the case and
 * performs the move, returning a string with the updated content.
 * @param {import('jsdom').DOMWindow} window
 */
function removeRedundantLangSpans(window) {
  const { document, HTMLElement } = window;

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
    } else if (span.parentElement && !span.previousSibling && !span.nextSibling) {
      // This span has more than one node, but it has no siblings. Move the lang
      // and children of the span to its parent.
      changes = true;
      span.parentElement.lang = span.lang;
      span.replaceWith(...span.childNodes);
    }
  }

  return changes;
}

/**
 * @param {import('jsdom').DOMWindow} window
 * @param {string[]} footnotes
 */
function addFootnotes(window, footnotes) {
  if (!footnotes.length) {
    return false;
  }

  const { document } = window;

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

  document.body.append(document.createElement('hr'), section);

  return true;
}

marked.use(
  gfmHeadingId(),
  markedHighlight({
    highlight(code, language) {
      return highlightjs.highlight(code, { language }).value;
    }
  }),
  {
    mangle: false,
    renderer: {
      image(href, title, text) {
        return href?.trim() ? composePicture(href, title, text, this.options.imagesMap) : text;
      }
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
        name: 'maths-inline',
        level: 'inline',
        start(src) {
          return src.match(/\$/)?.index;
        },
        tokenizer(src) {
          if (!src.startsWith('$')) {
            return;
          }

          const nextIndex = src.indexOf('$', 1);

          if (nextIndex !== -1) {
            return {
              type: 'maths-inline',
              raw: src.slice(0, nextIndex + 1)
            };
          }
        },
        renderer(tokens) {
          return temml.renderToString(tokens.raw.slice(1, tokens.raw.length - 1), {
            throwOnError: true,
            displayMode: false
          });
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

          const html = temml.renderToString(token.inner, {
            throwOnError: true,
            displayMode: true,
            annotate: true
          });
          const { window } = new JSDOM(html);

          const math = window.document.querySelector('math');
          math.id = `equation-${this.parser.options.equation}`;
          math.setAttribute('aria-label', token.inner.trim());
          math.removeAttribute('style');

          for (const el of math.querySelectorAll('[style]')) {
            el.removeAttribute('style');
          }

          return math.outerHTML;
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

          for (let i = 4, open = 1; i < src.length; i++) {
            const char = src[i];

            if (char === '[') {
              open++;
            } else if (char === ']') {
              open--;
            }

            if (open === 0) {
              return {
                type: 'refnote',
                raw: src.slice(0, i + 1),
                inner: this.lexer.inlineTokens(src.slice(4, i))
              };
            }
          }
        },
        renderer(token) {
          const { footnotes } = this.parser.options;

          footnotes.push(this.parser.parseInline(token.inner));

          const i = footnotes.length;

          return `<sup class="footnote-ref"><a id="footnote-ref-${i}" href="#footnote-${i}">[${i}]</a></sup>`;
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
    ],
    hooks: {
      preprocess(markdown) {
        this.options.equation = 0;
        this.options.lang = ['en'];
        this.options.footnotes = [];
        return markdown;
      },
      postprocess(html) {
        const { window } = new JSDOM(html);
        const spansRemoved = removeRedundantLangSpans(window);
        const footnotesAdded = addFootnotes(window, this.options.footnotes);

        return (spansRemoved || footnotesAdded) ? window.document.body.innerHTML : html;
      }
    }
  }
);

/**
 * @param {string} input
 * @param {Map<string, { width: number, height: number }>} imagesMap
 * @returns {string}
 */
export default function render(input, imagesMap) {
  return marked(input, { async: false, imagesMap });
}

